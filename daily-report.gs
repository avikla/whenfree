// ── Config ────────────────────────────────────────────────────────────────────
const REPORT_CONFIG = {
  projectId:  'meteor-meet',
  apiKey:     'AIzaSyCuqHAXIliejD8wfZvGRV04erVuU-WzhvM',
  collection: 'events',
  recipient:  'avi@meteor.co.il',
  tz:         'Asia/Jerusalem',
};

// ── Time window ───────────────────────────────────────────────────────────────
function getYesterdayWindow_() {
  const { tz } = REPORT_CONFIG;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  const yDateStr = Utilities.formatDate(yesterday, tz, 'yyyy-MM-dd');

  return {
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
    method:             'post',
    contentType:        'application/json',
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  const val  = json[0] && json[0].result &&
               json[0].result.aggregateFields &&
               json[0].result.aggregateFields.count &&
               json[0].result.aggregateFields.count.integerValue;
  return val ? parseInt(val, 10) : null;
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtNum_(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── HTML email builder ────────────────────────────────────────────────────────
function buildEmailHtml_(data) {
  var countStr  = data.eventCount !== null ? fmtNum_(data.eventCount) : 'N/A';
  var dateLabel = data.dateLabel;

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

      // Usage
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7E988F;margin-bottom:14px;">Usage &amp; Storage</div>' +
      '<div style="background:#F4FAF7;border:1px solid #D6EDE4;border-radius:12px;padding:16px 18px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td><div style="font-size:12px;color:#3E5750;font-weight:500;">Reads, writes, storage &amp; bandwidth</div>' +
              '<div style="font-size:12px;color:#7E988F;margin-top:3px;">View detailed usage in Firebase Console</div></td>' +
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
  try {
    var win        = getYesterdayWindow_();
    var eventCount = fetchEventCount_();
    var html       = buildEmailHtml_({ eventCount: eventCount, dateLabel: win.dateLabel });

    GmailApp.sendEmail(REPORT_CONFIG.recipient, 'Meteor · Daily DB Report — ' + win.dateLabel, '', {
      htmlBody: html,
      name:     'Meteor Meet',
    });

    console.log('Report sent for ' + win.dateLabel + ': events=' + eventCount);
  } catch (err) {
    console.error('sendDailyReport failed: ' + err.message);
    GmailApp.sendEmail(REPORT_CONFIG.recipient, 'Meteor · Daily DB Report FAILED', 'The daily report script failed with error: ' + err.message);
  }
}

// ── One-time trigger installer ────────────────────────────────────────────────
// Run this ONCE from the GAS editor. Safe to re-run — removes existing triggers first.
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
