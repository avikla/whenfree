# WhenFree — Incident History

Dated background for rules in `CLAUDE.md`. The rules themselves stay in `CLAUDE.md`. Read this file when you need to know why a rule exists, or before you revisit one of the decisions below.

## mailer.gs retired (commit `54482a5`)

`mailer.gs` was the GAS web app that sent all transactional mail. It was replaced by `functions/index.js`, which mail now goes through. The old `mailer.gs` had no auth check at all. The Cloud Function migration added the `X-WhenFree-Key` gate. The old "Production deployment ID" (`AKfycbz7hknVlxm...`, which served `mailer.gs`'s `doPost`) was confirmed removed from every project via `clasp deployments` on 2026-08-06. The ID no longer exists, so nothing needs to be done with it.

## Daily report on GAS: three outages, then migration (2026-09-14)

The old `daily-report.gs` GAS trigger went dark three times with the same signature. There was no execution log entry, no error, no `FAILED` email, and no `/fail` ping. The trigger stayed installed the whole time. `gcloud logging read` on `sendMail`'s request logs showed nightly 200s from a Google-Apps-Script user agent right up to a date, then total silence.

| Outage | Cause as found | Fix |
|---|---|---|
| 2026-08-01 to 2026-08-06 | Restricted OAuth scope `https://mail.google.com/` via `GmailApp` | `GmailApp` removed; mail moved to the ZeptoMail Cloud Function on 2026-08-06 |
| 2026-08-25/26 to 2026-09-05 | Restricted scope `.../auth/datastore`, shared with `cleanup.gs` in the same project and manifest | `cleanup.gs` split into its own GAS project on 2026-09-05 |
| 2026-09-12 to 2026-09-14 | Happened with `appsscript.json` scopes fully clean (`monitoring.read`, `script.scriptapp`, `script.external_request` only) | Migrated on 2026-09-14 |

Root cause: Apps Script authorization for an unverified ("Testing" mode) app silently expires roughly every 7 days. Google's trigger service cannot invoke the script on an expired grant, which is why no execution record was ever written. The third outage showed that the expiry happens regardless of which scopes are declared, so trimming scopes could not fix it.

The durable fix is the `dailyReport` Cloud Function on Cloud Scheduler. It uses the function's service-account credentials, which do not have the "Testing" mode expiry. It follows the same pattern `sendMail` already used for its own auth.

Watch for: a silent nightly report is now a different failure surface. OAuth expiry is not possible any more.

## `cleanup.gs` split into its own GAS project (2026-09-05)

`cleanup.gs` was split out of the shared GAS project so that its `datastore` OAuth scope could not take down the daily-report trigger. The cutover to the `gas-cleanup` deployment was verified working on 2026-09-05. The shared-project deployment `AKfycbwrdVpTaIvbtAH07eul9a6aJHQNSr59u5dTQIhoPy_boDLtYjTJhiTUxVuPfyErWQlHAg` is retired. The `gas-cleanup` deployment `AKfycby8owVTRjHWRZOO3EjcXk4lB4H8Gw5LmCH12O2HdhamuQMeh1rXRvb3ZEYVJkceNOs-5w` was created on the same day.

The root `daily-report.gs`, the root `appsscript.json`, and the root `.clasp.json` were deleted from the repo on 2026-09-14. The GAS project that held them can be left alone (harmless, unused) or trashed manually from the Apps Script editor.

## Organizer email exposed to every visitor (fixed 2026-08-19)

`creatorEmail` used to be written straight into the public `events/{slug}` document, which has `allow read: if true`. On every page load, `S.creatorEmail` was filled from Firestore for every visitor, not only the creator. `fireNotifyOrganizer()` then emailed the organizer directly from any participant's browser session. Any participant, or anyone the link leaked to, could read the organizer's address from loaded page state or a raw Firestore read.

The fix moved storage into `eventSecrets/{slug}` (client-unreadable) via the `storeCreatorEmail` Cloud Function. `notifyOrganizer` now looks the address up server-side. All 71 pre-existing events that had `creatorEmail` on the public doc were migrated the same day with a one-time copy-verify-delete script.

A follow-on bug in the same change: the field was removed from `allow create`, but the old equality check in `allow update` still referenced it unconditionally. `resource.data.foo` throws when `foo` is absent, so every update to a newly created event would have thrown until that line was also deleted.

## Reserved document ID broke the daily report's mail (`__unknown__`)

Firestore reserves document IDs matching `/^__.*__$/`. Two incidents came from this:

1. Testing `storeCreatorEmail` with a throwaway ID like `__curl_test__`. Harmless, just a bad test ID.
2. `checkAndIncrementMailCount_()`'s fallback bucket for requests with no `event_slug` was originally named `__unknown__`. Those requests came from `daily-report.gs`'s calls to `sendMail`. The rate-limit call sat outside `sendMail`'s try/catch, so the Firestore error was an unhandled rejection. The Functions Framework turned it into a bare 500 with no JSON body, which broke the daily report's mail send after the first deploy.

Fix: the bucket was renamed to `unknown`, and the whole rate-limit check was wrapped in a try/catch that fails open on any Firestore error.

## Leaked Firebase web key (GitHub secret-scanning alert)

The old Firebase web key (`AIzaSyCuq...`) was flagged by GitHub secret scanning. Commit `315b0da` rotated it in the code. The old key was deleted from GCP on 2026-09-29. Afterwards the `API_KEY` Script Property on the `gas-cleanup` project was found still holding the old key. It had been missed in the code rotation. Rule: update that property before deleting an old key.

## Midnight bug in calendar export

The wall-clock path produced a slot that ended at 24:00 with an end time before its start time. The fix moved all three calendar paths to UTC via `wallTimeToUtc()`. The `.ics` no longer emits `TZID` lines, because Outlook desktop rejects or shifts undefined TZIDs. The Google URL no longer uses `ctz`. Do not reintroduce either.

## Bidi reordering in the cross-timezone row label

An earlier version of the viewer-timezone row label joined two time strings (event tz and viewer tz, e.g. `09:00 · 10:00`) into one text node. Under Hebrew's `dir="rtl"`, the bidi algorithm reordered them to `10:00 · 09:00`, even though each fragment rendered correctly alone.

The fix was a redesign, not a patch. The label now uses two separate single-value grid columns (`.grid-time-label` and `.grid-time-label-viewer`). This avoids the bidi class of bug entirely. `.grid-time-label` also keeps `direction:ltr` as a defensive baseline.
