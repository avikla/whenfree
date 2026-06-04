# Daily DB Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a nightly GAS job that emails `avi@meteor.co.il` a styled HTML dashboard of Firestore usage (event count, daily reads/writes/deletes, monthly bandwidth) at midnight Israeli time.

**Architecture:** A new `daily-report.gs` file is added to the existing GAS project (alongside `mailer.gs`). It calls the Firestore REST API for document count and the Cloud Monitoring API for operation metrics, then sends a styled HTML email via `GmailApp`. A time-based GAS trigger fires the job at midnight `Asia/Jerusalem`.

**Tech Stack:** Google Apps Script (V8), Firestore REST API, Cloud Monitoring API v3, GmailApp, clasp CLI

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `appsscript.json` | Add `oauthScopes` for GmailApp + Cloud Monitoring + trigger management |
| Create | `daily-report.gs` | All report logic — config, metric fetchers, HTML builder, scheduler |

---

## Task 1: Update `appsscript.json` with OAuth scopes

**Files:**
- Modify: `appsscript.json`

Without explicit `oauthScopes`, GAS auto-detects scopes but won't include `monitoring.read`. Adding them explicitly locks in all required scopes.

- [ ] **Step 1: Replace `appsscript.json` content**

Full replacement (preserve all existing keys):

```json
{
  "timeZone": "Asia/Jerusalem",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/monitoring.read",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add appsscript.json
git commit -m "feat: add oauth scopes for monitoring and trigger management"
```

---

## Task 2: Create `daily-report.gs`

**Files:**
- Create: `daily-report.gs`

Create the file at the project root (same level as `mailer.gs`). Paste the full content below — do not split across multiple files.

- [ ] **Step 1: Create `daily-report.gs` with full content**

```javascript
// ── Config ────────────────────────────────────────────────────────────────────
const REPORT_CONFIG = {
  projectId:  'meteor-meet',
  apiKey:     'AIzaSyCuqHAXIliejD8wfZvGRV04erVuU-WzhvM',
  collection: 'events',
  recipient:  'avi@meteor.co.il',
  tz:         'Asia/Jerusalem',
  limits: {
    reads:     50000,
    writes:    20000,
    deletes:   20000,
    bandwidth: 10 * 1024 * 1024 * 1024,  // 10 GiB in bytes
  },
};

// ── Time window ───────────────────────────────────────────────────────────────
// Returns UTC ISO strings for yesterday 00:00:00 → today 00:00:00 in IST,
// plus a human-readable label for the email subject.
function getYesterdayWindow_() {
  const { tz } = REPORT_CONFIG;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  const yDateStr = Utilities.formatDate(yesterday, tz, 'yyyy-MM-dd');
  const tDateStr = Utilities.formatDate(now,       tz, 'yyyy-MM-dd');

  // Find what UTC time corresponds to midnight on a given IST date string.
  // Works for both UTC+2 (IST winter) and UTC+3 (IDT summer).
  function midnightISTtoUTC(dateStr) {
    // At noon UTC on this date, what hour is it in IST?
    const testDate = new Date(dateStr + 'T12:00:00Z');
    const istHour  = parseInt(Utilities.formatDate(testDate, tz, 'H'), 10);
    const [y, m, d] = dateStr.split('-').map(Number);
    // Midnight IST = midnight UTC minus the IST-UTC offset
    return new Date(Date.UTC(y, m - 1, d) - (istHour - 12) * 3600000);
  }

  return {
    start:     midnightISTtoUTC(yDateStr).toISOString(),
    end:       midnightISTtoUTC(tDateStr).toISOString(),
    dateLabel: Utilities.formatDate(yesterday, tz, 'EEE, d MMM yyyy'),
  };
}

// ── Firestore: count all documents in the events collection ──────────────────
function fetchEventCount_() {
  const { projectId, apiKey, collection } = REPORT_CONFIG;
  const url = 'https://firestore.googleapis.com/v1/projects/' + projectId +
              '/databases/(default)/documents:runAggregationQuery?key=' + apiKey;
  const payload = {
    structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: collection }] },
      aggregations: [{ count: {}, alias: 'count' }],
    },
  };
  const res = UrlFetchApp.fetch(url, {
    method:           'post',
    contentType:      'application/json',
    payload:          JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  const val  = json[0] && json[0].result &&
               json[0].result.aggregateFields &&
               json[0].result.aggregateFields.count &&
               json[0].result.aggregateFields.count.integerValue;
  return val ? parseInt(val, 10) : null;
}

// ── Cloud Monitoring: sum a daily metric over the given UTC window ────────────
function fetchMonitoringMetric_(metricType, startIso, endIso) {
  const { projectId } = REPORT_CONFIG;
  const token = ScriptApp.getOAuthToken();
  const base  = 'https://monitoring.googleapis.com/v3/projects/' + projectId + '/timeSeries';
  const qs = [
    'filter='                         + encodeURIComponent('metric.type="' + metricType + '"'),
    'interval.startTime='             + encodeURIComponent(startIso),
    'interval.endTime='               + encodeURIComponent(endIso),
    'aggregation.alignmentPeriod=86400s',
    'aggregation.perSeriesAligner=ALIGN_SUM',
    'aggregation.crossSeriesReducer=REDUCE_SUM',
  ].join('&');
  const res = UrlFetchApp.fetch(base + '?' + qs, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  if (!json.timeSeries || !json.timeSeries.length) return 0;
  return json.timeSeries[0].points.reduce(function(sum, p) {
    return sum + parseInt(p.value.int64Value || p.value.doubleValue || 0, 10);
  }, 0);
}

// ── Cloud Monitoring: sum outbound bandwidth since start of current month ─────
function fetchMonthlyBandwidth_() {
  const { projectId, tz } = REPORT_CONFIG;
  const token = ScriptApp.getOAuthToken();
  const now   = new Date();
  // First day of current month at midnight UTC (close enough for bandwidth)
  const monthStart = Utilities.formatDate(now, tz, 'yyyy-MM') + '-01T00:00:00Z';
  const base  = 'https://monitoring.googleapis.com/v3/projects/' + projectId + '/timeSeries';
  const qs = [
    'filter='                         + encodeURIComponent('metric.type="firestore.googleapis.com/network/sent_bytes_count"'),
    'interval.startTime='             + encodeURIComponent(monthStart),
    'interval.endTime='               + encodeURIComponent(now.toISOString()),
    'aggregation.alignmentPeriod='    + (30 * 86400) + 's',
    'aggregation.perSeriesAligner=ALIGN_SUM',
    'aggregation.crossSeriesReducer=REDUCE_SUM',
  ].join('&');
  const res = UrlFetchApp.fetch(base + '?' + qs, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  if (!json.timeSeries || !json.timeSeries.length) return 0;
  return json.timeSeries[0].points.reduce(function(sum, p) {
    return sum + parseInt(p.value.int64Value || p.value.doubleValue || 0, 10);
  }, 0);
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtNum_(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtBytes_(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024)        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function statusColor_(pct) {
  if (pct >= 0.9) return '#E5534B';  // red
  if (pct >= 0.7) return '#F5A623';  // yellow
  return '#00C281';                   // green
}

// Returns HTML for one stat card (used inside a <td>)
function statCard_(label, displayValue, limitLabel, pct) {
  var color  = statusColor_(pct);
  var barPct = Math.min(pct * 100, 100).toFixed(1);
  return '<td style="width:50%;padding:6px;" valign="top">' +
    '<div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:16px 18px;">' +
      '<div style="font-size:12px;color:#3E5750;font-weight:500;margin-bottom:6px;">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:5px;vertical-align:middle;"></span>' +
        label +
      '</div>' +
      '<div style="font-size:26px;font-weight:700;color:#0B2018;line-height:1;">' +
        displayValue +
        '<span style="font-size:13px;color:#7E988F;font-weight:400;margin-left:2px;">/ ' + limitLabel + '</span>' +
      '</div>' +
      '<div style="margin-top:10px;">' +
        '<div style="background:#D6EDE4;border-radius:100px;height:6px;overflow:hidden;">' +
          '<div style="width:' + barPct + '%;background:' + color + ';height:100%;border-radius:100px;"></div>' +
        '</div>' +
        '<div style="margin-top:5px;">' +
          '<span style="font-size:11px;color:#3E5750;font-weight:600;">' + barPct + '%</span>' +
          '<span style="font-size:11px;color:#7E988F;float:right;">limit: ' + limitLabel + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</td>';
}

// ── HTML email builder ────────────────────────────────────────────────────────
function buildEmailHtml_(data) {
  var eventCount = data.eventCount;
  var reads      = data.reads;
  var writes     = data.writes;
  var deletes    = data.deletes;
  var bandwidth  = data.bandwidth;
  var dateLabel  = data.dateLabel;
  var limits     = REPORT_CONFIG.limits;

  var readsPct  = reads     / limits.reads;
  var writesPct = writes    / limits.writes;
  var delPct    = deletes   / limits.deletes;
  var bwPct     = bandwidth / limits.bandwidth;
  var countStr  = eventCount !== null ? fmtNum_(eventCount) : 'N/A';

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '</head><body style="margin:0;background:#e8f0eb;font-family:\'Segoe UI\',system-ui,sans-serif;padding:32px 16px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    '<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">' +

    // Header
    '<tr><td style="background:#0B2018;padding:28px 36px 24px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="color:#00C281;font-size:22px;font-weight:700;letter-spacing:-0.5px;"><span style="color:#fff;">Meteor</span> Meet</td>' +
        '<td align="right"><span style="background:rgba(0,194,129,.15);color:#00C281;font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px;">' + dateLabel + '</span></td>' +
      '</tr></table>' +
      '<div style="color:#5A7D6E;font-size:13px;margin-top:6px;">Daily DB Report &mdash; midnight to midnight (IST)</div>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:28px 36px 32px;">' +

      // Total events
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;">Database</div>' +
      '<div style="background:#0B2018;border-radius:12px;padding:20px 22px;margin-bottom:24px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td><div style="font-size:12px;color:#5A7D6E;font-weight:500;margin-bottom:4px;">Total events stored</div>' +
              '<div style="font-size:42px;font-weight:700;color:#fff;line-height:1;">' + countStr + '</div></td>' +
          '<td align="right"><a href="https://console.firebase.google.com/project/meteor-meet/firestore" ' +
            'style="background:#00C281;color:#04261B;font-size:12px;font-weight:700;padding:8px 16px;border-radius:100px;text-decoration:none;">Console &#8594;</a></td>' +
        '</tr></table>' +
      '</div>' +

      // Operations grid
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;">Daily Operations (free-tier limits)</div>' +
      '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>' +
        statCard_('Reads',   fmtNum_(reads),   '50,000', readsPct) +
        statCard_('Writes',  fmtNum_(writes),  '20,000', writesPct) +
      '</tr><tr>' +
        statCard_('Deletes', fmtNum_(deletes), '20,000', delPct) +
        statCard_('Bandwidth (month)', fmtBytes_(bandwidth), '10 GB', bwPct) +
      '</tr></table>' +

      // Storage
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;">Storage</div>' +
      '<div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:16px 18px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td><div style="font-size:12px;color:#3E5750;font-weight:500;">Raw storage bytes</div>' +
              '<div style="font-size:12px;color:#7E988F;margin-top:3px;">Not available via API &mdash; view in Firebase Console</div></td>' +
          '<td align="right"><a href="https://console.firebase.google.com/project/meteor-meet/firestore/usage" ' +
            'style="background:#00C281;color:#04261B;font-size:12px;font-weight:700;padding:8px 16px;border-radius:100px;text-decoration:none;">View &#8594;</a></td>' +
        '</tr></table>' +
      '</div>' +

    '</td></tr>' +

    // Footer
    '<tr><td style="background:#F4FAF7;border-top:1px solid #D6EDE4;padding:18px 36px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-size:12px;color:#7E988F;">Meteor Meet &middot; no-reply@meteor.co.il</td>' +
        '<td align="right"><a href="https://console.firebase.google.com/project/meteor-meet/firestore" ' +
          'style="font-size:12px;color:#00C281;text-decoration:none;font-weight:600;">Firebase Console &#8594;</a></td>' +
      '</tr></table>' +
    '</td></tr>' +

    '</table></td></tr></table></body></html>';
}

// ── Main entry point ──────────────────────────────────────────────────────────
function sendDailyReport() {
  var win       = getYesterdayWindow_();
  var recipient = REPORT_CONFIG.recipient;

  var eventCount = fetchEventCount_();
  var reads      = fetchMonitoringMetric_('firestore.googleapis.com/document/read_count',   win.start, win.end);
  var writes     = fetchMonitoringMetric_('firestore.googleapis.com/document/write_count',  win.start, win.end);
  var deletes    = fetchMonitoringMetric_('firestore.googleapis.com/document/delete_count', win.start, win.end);
  var bandwidth  = fetchMonthlyBandwidth_();

  var html = buildEmailHtml_({ eventCount: eventCount, reads: reads, writes: writes, deletes: deletes, bandwidth: bandwidth, dateLabel: win.dateLabel });

  GmailApp.sendEmail(recipient, 'Meteor · Daily DB Report — ' + win.dateLabel, '', {
    htmlBody: html,
    name:     'Meteor Meet',
  });

  console.log('Report sent for ' + win.dateLabel + ': events=' + eventCount + ', reads=' + reads + ', writes=' + writes + ', deletes=' + deletes + ', bw=' + bandwidth);
}

// ── One-time trigger installer ────────────────────────────────────────────────
// Run this ONCE from the GAS editor. It installs a daily midnight trigger.
// Safe to re-run — removes existing sendDailyReport triggers first.
function createTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'sendDailyReport'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .atHour(0)
    .everyDays(1)
    .create();

  console.log('Trigger created: sendDailyReport fires daily at midnight (Asia/Jerusalem).');
}
```

- [ ] **Step 2: Commit**

```bash
git add daily-report.gs
git commit -m "feat: add daily DB report GAS script"
```

---

## Task 3: Deploy to GAS via `clasp push`

**Files:** none (deployment step)

- [ ] **Step 1: Push to GAS**

From the project root (where `.clasp.json` lives):

```powershell
clasp push
```

Expected output:
```
└─ appsscript.json
└─ daily-report.gs
└─ mailer.gs
Pushed 3 files.
```

If clasp asks to overwrite, confirm yes.

- [ ] **Step 2: Commit the pushed state**

```bash
git add .
git commit -m "chore: deploy daily-report to GAS"
```

---

## Task 4: Enable Cloud Monitoring API (manual, one-time)

This step cannot be scripted — it must be done in the GCP Console.

- [ ] **Step 1: Open the Cloud Monitoring API page**

Go to:
```
https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=meteor-meet
```

- [ ] **Step 2: Click "Enable"**

If already enabled, the button will say "Manage" — nothing to do.

---

## Task 5: Install trigger and verify

- [ ] **Step 1: Open the GAS editor**

Go to:
```
https://script.google.com/d/1MCoKYf2EVaueAzpjWAmHdvzubUcj3NqLAXzrBic6oRZgxacpnf44uYBD/edit
```

- [ ] **Step 2: Authorize the new scopes**

On first run after adding `oauthScopes`, GAS will prompt for re-authorization. Click through — you'll be asked to approve Gmail and Cloud Monitoring access.

- [ ] **Step 3: Run `createTrigger` once**

In the GAS editor, select `createTrigger` from the function dropdown and click Run.

Expected log output:
```
Trigger created: sendDailyReport fires daily at midnight (Asia/Jerusalem).
```

Verify in GAS: go to **Triggers** (clock icon in left sidebar) — should show one `sendDailyReport` trigger, time-driven, daily.

- [ ] **Step 4: Run `sendDailyReport` manually to verify email**

Select `sendDailyReport` from the function dropdown and click Run.

Expected log:
```
Report sent for [yesterday's date]: events=<n>, reads=<n>, writes=<n>, deletes=<n>, bw=<n>
```

- [ ] **Step 5: Check inbox**

Open `avi@meteor.co.il` — confirm the email arrived with:
- Correct subject: `Meteor · Daily DB Report — [date]`
- Total events card shows a non-zero number
- Reads/writes/deletes cards show values with progress bars
- Bandwidth card shows a value
- "View →" and "Console →" links open the correct Firebase Console pages

---

## Notes

- **No `createdAt` field on events** — the "new events yesterday" delta is not implemented (documents are created with `.set()` and no timestamp). Total count only.
- **Bandwidth metric** returns 0 until Cloud Monitoring has data (can take up to 24h after first enable).
- **Trigger timezone** uses the script timezone (`Asia/Jerusalem` in `appsscript.json`) — no extra config needed.
