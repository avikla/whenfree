# Daily DB Report — Design Spec

## Context

Meteor Meet runs on Firebase Firestore (Spark/free tier). There's no visibility into daily usage against free-tier limits. This feature adds a daily HTML email dashboard sent to `avi@meteor.co.il` at midnight Israeli time, summarizing the previous calendar day's database activity.

## Architecture

A single new file `daily-report.gs` is added to the existing GAS project (scriptId: `1MCoKYf2EVaueAzpjWAmHdvzubUcj3NqLAXzrBic6oRZgxacpnf44uYBD`, alongside `mailer.gs`). It exposes two functions:

- `sendDailyReport()` — the main job: collects metrics, builds HTML, sends email
- `createTrigger()` — one-time setup helper: installs the midnight time-based trigger

No changes to `index.html` or `mailer.gs`.

## Data Sources

| Metric | API | Auth |
|---|---|---|
| Total meeting document count | Firestore REST `runAggregationQuery` on `meetings` collection | API key from firebaseConfig |
| New meetings yesterday (delta) | Firestore REST query filtered by `createdAt` timestamp range | API key | Falls back to "N/A" if `createdAt` field absent |
| Daily reads / writes / deletes | Cloud Monitoring API `timeSeries.list` | `ScriptApp.getOAuthToken()` |
| Monthly outbound bandwidth | Cloud Monitoring API `timeSeries.list` | `ScriptApp.getOAuthToken()` |
| Raw storage bytes | Not available via API — Firebase Console link in email footer | — |

**Cloud Monitoring metric types:**
- `firestore.googleapis.com/document/read_count`
- `firestore.googleapis.com/document/write_count`
- `firestore.googleapis.com/document/delete_count`
- `firestore.googleapis.com/network/sent_bytes_count`

**Query window:** previous calendar day, 00:00:00–23:59:59 Asia/Jerusalem, converted to UTC for API calls.

## Email

- **From:** `no-reply@meteor.co.il`
- **To:** `avi@meteor.co.il`
- **Subject:** `Meteor · Daily DB Report — [Wed, 4 Jun 2026]`
- **Sent via:** `GmailApp.sendEmail()` with `htmlBody`

**Layout (top to bottom):**
1. Dark header with logo + date badge + subtitle
2. Total meetings card (count + yesterday's delta)
3. Operations grid (reads, writes, deletes) — each with value, progress bar, % of free-tier limit
4. Monthly bandwidth card — progress bar against 10 GB/month
5. Storage card — "not available via API" + "View →" button to Firebase Console
6. Footer with Firebase Console link

**Status indicator colors:**
- Green: < 70% of limit
- Yellow: 70–90%
- Red: > 90%

## Free-Tier Limits (Spark Plan)

| Metric | Daily limit |
|---|---|
| Reads | 50,000 |
| Writes | 20,000 |
| Deletes | 20,000 |
| Bandwidth | 10 GB / month |

## Scheduling

GAS time-based trigger fires daily at midnight `Asia/Jerusalem`. GAS project timezone is already set to `Asia/Jerusalem` in `appsscript.json`. `createTrigger()` uses `ScriptApp.newTrigger('sendDailyReport').timeBased().atHour(0).everyDays(1).create()`.

## Required One-Time Manual Steps

1. **Enable Cloud Monitoring API** in GCP Console for project `meteor-meet`
2. **Run `createTrigger()`** once from the GAS editor to install the trigger

## appsscript.json Changes

Add OAuth scope:
```json
"https://www.googleapis.com/auth/monitoring.read"
```

## Files Modified

- `daily-report.gs` — new file (all logic)
- `appsscript.json` — add `monitoring.read` scope

## Verification

1. Run `sendDailyReport()` manually from GAS editor
2. Check `avi@meteor.co.il` inbox for the email
3. Verify each metric block renders with correct values and color indicators
4. Confirm "View →" Firebase Console link opens the correct page
5. Run `createTrigger()` once, check GAS Triggers panel shows a daily midnight trigger
