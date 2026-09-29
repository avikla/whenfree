'use strict';

const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
admin.initializeApp();
// Lazy: constructing the Firestore client resolves project credentials immediately,
// which throws outside a GCP environment — keep `node --test` (pure-function tests,
// no Firestore calls) working without ambient credentials.
let _db = null;
function getDb() {
  if (!_db) _db = admin.firestore();
  return _db;
}

const FROM = { address: 'no-reply@whenfree.org', name: 'WhenFree' };
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>.]+$/; // TLD excludes '.' so the domain split is unambiguous (no ReDoS)

function checkAuth(req) {
  return req.get('X-WhenFree-Key') === process.env.WHENFREE_MAIL_KEY;
}

function parseRequestBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function buildZeptoPayload({ to_email, event_name, meeting_url, subject, body, html_body }) {
  return {
    from: FROM,
    to: [{ email_address: { address: to_email } }],
    subject: subject || `Your meeting link: ${event_name}`,
    htmlbody: html_body || `<p>Hi,</p><p>Here is your meeting link: <a href="${meeting_url}">${meeting_url}</a></p>`,
    textbody: body || `Hi,\n\nHere is your meeting link:\n${meeting_url}`,
  };
}

const ZEPTO_ENDPOINT = 'https://api.zeptomail.com/v1.1/email';
const ALERT_EMAIL = 'avi.klayman@gmail.com';
const ALLOWED_ORIGIN = 'https://whenfree.org';
const DAILY_MAIL_CAP = 100;

function setCors(res) {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-WhenFree-Key');
}

async function sendAlert(toEmail, subject, detail) {
  await fetch(ZEPTO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': process.env.ZEPTO_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [{ email_address: { address: ALERT_EMAIL } }],
      subject: 'WhenFree · Mail send failed',
      textbody: `To: ${toEmail}\nSubject: ${subject}\n\nDetail:\n${detail}`,
    }),
  }).catch(() => {});
}

// Sends one message via ZeptoMail; used by both sendMail and notifyOrganizer.
async function sendViaZepto_(payload) {
  const response = await fetch(ZEPTO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': process.env.ZEPTO_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  return { ok: response.status >= 200 && response.status < 300, status: response.status, bodyText };
}

// Caps sends per event per UTC day so the mail relay can't be used for bulk spam,
// while leaving the legitimate arbitrary-recipient invite feature untouched.
// Requests with no event_slug (e.g. daily-report.gs, which isn't tied to one event)
// share a single bucket so that path is capped too. "unknown", not "__unknown__" —
// Firestore reserves document IDs matching /^__.*__$/.
// Fails open (returns true) on any unexpected Firestore error so a rate-limiter
// hiccup can never take down actual mail delivery — this is defense-in-depth, not
// the primary abuse control.
async function checkAndIncrementMailCount_(eventSlug) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const db = getDb();
    const ref = db.collection('mailCounts').doc(eventSlug || 'unknown');
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : null;
      const count = data && data.date === today ? data.count : 0;
      if (count >= DAILY_MAIL_CAP) return false;
      tx.set(ref, { date: today, count: count + 1 });
      return true;
    });
  } catch (err) {
    console.error('checkAndIncrementMailCount_ failed, failing open:', err.message);
    return true;
  }
}

async function sendMail(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!checkAuth(req)) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return;
  }

  const data = parseRequestBody(req);
  const { to_email, subject, event_slug } = data;
  if (!EMAIL_RE.test(to_email || '')) {
    res.status(200).json({ ok: false, error: 'invalid_recipient' });
    return;
  }
  const payload = buildZeptoPayload(data);

  const underCap = await checkAndIncrementMailCount_(event_slug);
  if (!underCap) {
    res.status(200).json({ ok: false, error: 'rate_limited' });
    return;
  }

  try {
    const { ok, status, bodyText } = await sendViaZepto_(payload);
    if (!ok) {
      await sendAlert(to_email, subject, bodyText);
      res.status(200).json({ ok: false, error: `ZeptoMail HTTP ${status}`, detail: bodyText });
      return;
    }
    const result = JSON.parse(bodyText);
    res.status(200).json({ ok: true, messageId: result.request_id });
  } catch (err) {
    await sendAlert(to_email, subject, err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
}

// Stores the creator's email server-side, out of the public `events/{slug}` document.
// Authorized by creatorToken matching the event doc — the same trust level the app
// already uses for creator-only actions (client-gated, no server-side Firebase Auth).
// Writes with .create() so a later call can't overwrite an already-stored email.
async function storeCreatorEmail(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!checkAuth(req)) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return;
  }

  const { eventSlug, creatorEmail, creatorToken } = parseRequestBody(req);
  if (!eventSlug || !creatorEmail || !creatorToken) {
    res.status(400).json({ ok: false, error: 'missing_fields' });
    return;
  }

  try {
    const db = getDb();
    const eventSnap = await db.collection('events').doc(eventSlug).get();
    if (!eventSnap.exists || eventSnap.data().creatorToken !== creatorToken) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }
    await db.collection('eventSecrets').doc(eventSlug).create({ creatorEmail });
    res.status(200).json({ ok: true });
  } catch (err) {
    // ALREADY_EXISTS (gRPC code 6) means this event's email was already stored once.
    if (err.code === 6) {
      res.status(200).json({ ok: true });
      return;
    }
    res.status(200).json({ ok: false, error: err.message });
  }
}

// Notifies the organizer that a participant responded, without the client ever
// seeing the organizer's email — the address is looked up server-side from
// eventSecrets, which client SDKs cannot read.
async function notifyOrganizer(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!checkAuth(req)) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return;
  }

  const { eventSlug, subject, body, html_body, event_name, meeting_url } = parseRequestBody(req);
  if (!eventSlug) {
    res.status(400).json({ ok: false, error: 'missing_fields' });
    return;
  }

  try {
    const db = getDb();
    const [eventSnap, secretSnap] = await Promise.all([
      db.collection('events').doc(eventSlug).get(),
      db.collection('eventSecrets').doc(eventSlug).get(),
    ]);
    const notifyOnResponse = eventSnap.exists && eventSnap.data().notifyOnResponse;
    const creatorEmail = secretSnap.exists ? secretSnap.data().creatorEmail : null;
    if (!notifyOnResponse || !creatorEmail) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }
    if (!EMAIL_RE.test(creatorEmail)) {
      res.status(200).json({ ok: false, error: 'invalid_recipient' });
      return;
    }

    const underCap = await checkAndIncrementMailCount_(eventSlug);
    if (!underCap) {
      res.status(200).json({ ok: false, error: 'rate_limited' });
      return;
    }

    const payload = buildZeptoPayload({ to_email: creatorEmail, event_name, meeting_url, subject, body, html_body });
    const { ok, status, bodyText } = await sendViaZepto_(payload);
    if (!ok) {
      await sendAlert(creatorEmail, subject, bodyText);
      res.status(200).json({ ok: false, error: `ZeptoMail HTTP ${status}`, detail: bodyText });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}

// ── Daily DB usage report ─────────────────────────────────────────────────────
// Ported from the old daily-report.gs GAS trigger, which relied on a per-user
// OAuth grant that Google silently expires every ~7 days for an unverified
// ("Testing" mode) app — regardless of which scopes are declared. That killed
// the nightly trigger three times (Aug 2026, twice, then again Sep 2026) with
// zero trace each time. Cloud Scheduler + this function use the function's own
// service-account credentials instead, which don't expire on that timer.
const REPORT_RECIPIENT = 'avi.klayman@gmail.com';
const REPORT_TZ = 'Asia/Jerusalem';
const REPORT_CLEANUP_URL = 'https://cleanup.whenfree.org/';
const REPORT_LIMITS = { reads: 50000, writes: 20000, deletes: 20000, storage: 1 * 1024 * 1024 * 1024 };

function formatDateInTz_(date, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function hourInTz_(date, tz) {
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(date), 10);
}

function midnightInTzToUtc_(dateStr, tz) {
  const testDate = new Date(dateStr + 'T12:00:00Z');
  const localHour = hourInTz_(testDate, tz);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - (localHour - 12) * 3600000);
}

// en-US is used deliberately over en-GB: ICU's en-GB short-month form renders
// September as "Sept" (4 letters) while every other month is 3 letters — an
// inconsistency caught by index.test.js. en-US is 3-letter for all 12 months.
function formatReportDateLabel_(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`;
}

function getYesterdayWindow_() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  return {
    start: midnightInTzToUtc_(formatDateInTz_(yesterday, REPORT_TZ), REPORT_TZ).toISOString(),
    end: midnightInTzToUtc_(formatDateInTz_(now, REPORT_TZ), REPORT_TZ).toISOString(),
    dateLabel: formatReportDateLabel_(yesterday, REPORT_TZ),
  };
}

async function fetchEventCount_() {
  const snap = await getDb().collection('events').count().get();
  return snap.data().count;
}

async function fetchNewEventsCount_(startIso, endIso) {
  const snap = await getDb().collection('events')
    .where('createdAt', '>=', new Date(startIso))
    .where('createdAt', '<', new Date(endIso))
    .count().get();
  return snap.data().count;
}

let _monitoringAuth = null;
async function getMonitoringToken_() {
  if (!_monitoringAuth) _monitoringAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/monitoring.read'] });
  const client = await _monitoringAuth.getClient();
  return (await client.getAccessToken()).token;
}

async function fetchMonitoringMetric_(metricType, startIso, endIso) {
  const token = await getMonitoringToken_();
  const qs = new URLSearchParams({
    filter: `metric.type="${metricType}"`,
    'interval.startTime': startIso,
    'interval.endTime': endIso,
    'aggregation.alignmentPeriod': '86400s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const res = await fetch(`https://monitoring.googleapis.com/v3/projects/meteor-meet/timeSeries?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Monitoring API error ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  if (!json.timeSeries || !json.timeSeries.length) return 0;
  return json.timeSeries[0].points.reduce((sum, p) => sum + parseInt(p.value.int64Value || p.value.doubleValue || 0, 10), 0);
}

async function fetchStorageBytes_() {
  const token = await getMonitoringToken_();
  const now = new Date();
  const qs = new URLSearchParams({
    filter: 'metric.type="firestore.googleapis.com/storage/data_and_index_storage_bytes"',
    'interval.startTime': new Date(now.getTime() - 86400000).toISOString(),
    'interval.endTime': now.toISOString(),
    'aggregation.alignmentPeriod': '86400s',
    'aggregation.perSeriesAligner': 'ALIGN_MEAN',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const res = await fetch(`https://monitoring.googleapis.com/v3/projects/meteor-meet/timeSeries?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Storage API error ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  const points = json.timeSeries && json.timeSeries[0] && json.timeSeries[0].points;
  if (!points || !points.length) return 0;
  return parseInt(points[0].value.int64Value || points[0].value.doubleValue || 0, 10);
}

function fmtNum_(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtBytes_(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function statusColor_(pct) {
  if (pct >= 0.9) return '#E5534B';
  if (pct >= 0.7) return '#F5A623';
  return '#00C281';
}

function statCard_(label, displayValue, limitLabel, pct) {
  const color = statusColor_(pct);
  const barPct = Math.min(pct * 100, 100).toFixed(1);
  return `<td style="width:50%;padding:6px;" valign="top">
    <div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:16px 18px;">
      <div style="font-size:12px;color:#3E5750;font-weight:500;margin-bottom:6px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle;"></span>
        ${label}
      </div>
      <div style="font-size:26px;font-weight:700;color:#0B2018;line-height:1;">
        ${displayValue}<span style="font-size:13px;color:#7E988F;font-weight:400;margin-left:2px;">/ ${limitLabel}</span>
      </div>
      <div style="margin-top:10px;">
        <div style="background:#D6EDE4;border-radius:100px;height:6px;overflow:hidden;">
          <div style="width:${barPct}%;background:${color};height:100%;border-radius:100px;"></div>
        </div>
        <div style="margin-top:5px;">
          <span style="font-size:11px;color:#3E5750;font-weight:600;">${barPct}%</span>
          <span style="font-size:11px;color:#7E988F;float:right;">limit: ${limitLabel}</span>
        </div>
      </div>
    </div>
  </td>`;
}

function buildReportEmailHtml_(data) {
  const eventCount = data.eventCount;
  const reads = data.reads ?? 0;
  const writes = data.writes ?? 0;
  const deletes = data.deletes ?? 0;
  const storage = data.storage ?? 0;
  const dateLabel = data.dateLabel;

  const readsPct = reads / REPORT_LIMITS.reads;
  const writesPct = writes / REPORT_LIMITS.writes;
  const delPct = deletes / REPORT_LIMITS.deletes;
  const storagePct = storage / REPORT_LIMITS.storage;
  const countStr = eventCount !== null ? fmtNum_(eventCount) : 'N/A';
  const newEventsStr = data.newEvents !== null && data.newEvents !== undefined ? fmtNum_(data.newEvents) : '—';

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    </head><body style="margin:0;background:#e8f0eb;font-family:'Segoe UI',system-ui,sans-serif;padding:32px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <tr><td style="background:#0B2018;padding:28px 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="color:#00C281;font-size:22px;font-weight:700;letter-spacing:-0.5px;"><span style="color:#fff;">When</span>Free</td>
        <td align="right"><span style="background:rgba(0,194,129,.15);color:#00C281;font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px;">${dateLabel}</span></td>
      </tr></table>
      <div style="color:#5A7D6E;font-size:13px;margin-top:6px;">Daily DB Report &mdash; midnight to midnight (IST)</div>
    </td></tr>

    <tr><td style="padding:28px 36px 32px;">

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;">Database</div>
      <div style="background:#0B2018;border-radius:12px;padding:20px 22px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <div style="font-size:12px;color:#5A7D6E;font-weight:500;margin-bottom:4px;">Total events stored</div>
            <div style="font-size:42px;font-weight:700;color:#fff;line-height:1;">${countStr}</div>
            <div style="margin-top:8px;font-size:12px;color:#5A7D6E;font-weight:500;">New today</div>
            <div style="font-size:28px;font-weight:700;color:#00C281;line-height:1;">${newEventsStr}</div>
          </td>
          <td align="right"><a href="https://console.firebase.google.com/project/meteor-meet/firestore"
            style="background:#00C281;color:#04261B;font-size:12px;font-weight:700;padding:8px 16px;border-radius:100px;text-decoration:none;">Console &#8594;</a></td>
        </tr></table>
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;">Daily Operations &amp; Storage</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr>
        ${statCard_('Reads', fmtNum_(reads), '50,000', readsPct)}
        ${statCard_('Writes', fmtNum_(writes), '20,000', writesPct)}
      </tr><tr>
        ${statCard_('Deletes', fmtNum_(deletes), '20,000', delPct)}
        ${statCard_('Storage', fmtBytes_(storage), '1 GB', storagePct)}
      </tr></table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
        <td style="padding:6px;">
          <div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td><div style="font-size:12px;color:#3E5750;font-weight:500;">Full usage details</div>
                  <div style="font-size:12px;color:#7E988F;margin-top:2px;">Reads, writes, and storage over time in Cloud Console</div></td>
              <td align="right"><a href="https://console.cloud.google.com/firestore/databases/-default-/usage?project=meteor-meet"
                style="background:#00C281;color:#04261B;font-size:12px;font-weight:700;padding:8px 16px;border-radius:100px;text-decoration:none;white-space:nowrap;">View &#8594;</a></td>
            </tr></table>
          </div>
        </td>
      </tr></table>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;margin-top:8px;">Maintenance</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
        <td style="padding:6px;">
          <div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:12px;color:#3E5750;font-weight:500;">Expired meeting cleanup</div>
                <div style="font-size:12px;color:#7E988F;margin-top:2px;">Review and delete expired events from Firestore</div>
              </td>
              <td align="right"><a href="${REPORT_CLEANUP_URL}"
                style="background:#00C281;color:#04261B;font-size:12px;font-weight:700;padding:8px 16px;border-radius:100px;text-decoration:none;white-space:nowrap;">Open &#8594;</a></td>
            </tr></table>
          </div>
        </td>
      </tr></table>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;margin-top:8px;">Email</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr>
        <td style="padding:6px;">
          <div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:14px 18px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:12px;color:#3E5750;font-weight:500;">Transactional emails</div>
                <div style="font-size:12px;color:#7E988F;margin-top:2px;">Sent via ZeptoMail &mdash; view delivery stats, bounces, and logs</div>
              </td>
              <td align="right"><a href="https://zeptomail.zoho.com/zem/927167870#agents/4db6f9fa7dd3976f/processed-emails"
                style="background:#00C281;color:#04261B;font-size:12px;font-weight:700;padding:8px 16px;border-radius:100px;text-decoration:none;white-space:nowrap;">View &#8594;</a></td>
            </tr></table>
          </div>
        </td>
      </tr></table>

    </td></tr>

    <tr><td style="background:#F4FAF7;border-top:1px solid #D6EDE4;padding:18px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;color:#7E988F;">WhenFree &middot; no-reply@meteor.co.il</td>
        <td align="right"><a href="https://console.firebase.google.com/project/meteor-meet/firestore"
          style="font-size:12px;color:#00C281;text-decoration:none;font-weight:600;">Firebase Console &#8594;</a></td>
      </tr></table>
    </td></tr>

    </table></td></tr></table></body></html>`;
}

async function pingHealthcheck_(suffix) {
  const url = process.env.HEALTHCHECK_PING_URL;
  if (!url) return;
  try {
    await fetch(url + (suffix || ''));
  } catch (e) {
    console.error('Healthcheck ping failed:', e.message);
  }
}

async function sendReportMail_(subject, body, htmlBody) {
  const result = await sendViaZepto_(buildZeptoPayload({ to_email: REPORT_RECIPIENT, subject, body, html_body: htmlBody }));
  if (!result.ok) console.error(`Daily report mail send failed: HTTP ${result.status}: ${result.bodyText}`);
}

// HTTP target for the `dailyReport` Cloud Scheduler job (deployed without
// --allow-unauthenticated; Scheduler's OIDC identity token is the only
// accepted caller, so there's no header/secret check like the other handlers).
async function dailyReport(req, res) {
  try {
    const win = getYesterdayWindow_();
    const [eventCount, newEvents, reads, writes, deletes, storage] = await Promise.all([
      fetchEventCount_(),
      fetchNewEventsCount_(win.start, win.end),
      fetchMonitoringMetric_('firestore.googleapis.com/document/read_count', win.start, win.end),
      fetchMonitoringMetric_('firestore.googleapis.com/document/write_count', win.start, win.end),
      fetchMonitoringMetric_('firestore.googleapis.com/document/delete_count', win.start, win.end),
      fetchStorageBytes_(),
    ]);

    const html = buildReportEmailHtml_({ eventCount, newEvents, reads, writes, deletes, storage, dateLabel: win.dateLabel });
    await sendReportMail_(
      `WhenFree · Daily DB Report — ${win.dateLabel}`,
      `WhenFree Daily DB Report for ${win.dateLabel} — open in an HTML-capable mail client to view the full report.`,
      html
    );

    console.log(`Report sent for ${win.dateLabel}: events=${eventCount}, reads=${reads}, writes=${writes}, deletes=${deletes}, storage=${storage}`);
    await pingHealthcheck_();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('dailyReport failed:', err.message);
    const failMsg = `The daily report script failed with error: ${err.message}`;
    await sendReportMail_(
      'WhenFree · Daily DB Report FAILED',
      failMsg,
      `<p>${failMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    ).catch(() => {});
    await pingHealthcheck_('/fail');
    res.status(200).json({ ok: false, error: err.message });
  }
}

module.exports = {
  checkAuth,
  buildZeptoPayload,
  parseRequestBody,
  sendMail,
  storeCreatorEmail,
  notifyOrganizer,
  dailyReport,
  getYesterdayWindow_,
  fmtNum_,
  fmtBytes_,
  FROM,
  EMAIL_RE,
};
