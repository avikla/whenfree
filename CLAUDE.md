# WhenFree — Project Context

## Overview

Single-file meeting scheduler (when2meet alternative). Real-time availability sync via Firebase Firestore, ranked best-time finder, per-user colors, dark/light mode toggle, Hebrew/French/English i18n with RTL support. Hosted at `whenfree.org`.

Incident history and the reasons behind some rules: [docs/incident-history.md](docs/incident-history.md).

## Repository & Deployment

- GitHub: https://github.com/avikla/whenfree
- Deployment: GitHub Pages (automatic on push to `main`)
- Remote was renamed from `Meteor-Meet` → `whenfree`

Push from inside the project folder:

```powershell
cd "projects/whenfree"
git add .
git commit -m "..."
git push
```

## Files & Architecture

| File | Role |
|------|------|
| `index.html` | Single-page app (HTML, CSS, JS inline) with Firebase Firestore integration |
| `functions/index.js` | Four Firebase Cloud Functions, each its own deployment sharing this one source file: `sendMail` (sends app emails via ZeptoMail API from `no-reply@whenfree.org`), `storeCreatorEmail` (writes the organizer's email server-side into `eventSecrets/{slug}`), `notifyOrganizer` (looks up that email server-side and sends the "participant responded" notification — the client never sees the address), `dailyReport` (nightly DB usage report — see Daily DB Report). `sendMail`/`storeCreatorEmail`/`notifyOrganizer` share an `X-WhenFree-Key` header check; `dailyReport` instead requires Cloud Scheduler's IAM/OIDC auth (no public callers). Uses `firebase-admin` (lazily initialized — see Security Patterns) and `google-auth-library` (for `dailyReport`'s Cloud Monitoring calls). URLs: `https://us-central1-meteor-meet.cloudfunctions.net/{sendMail,storeCreatorEmail,notifyOrganizer,dailyReport}`. |
| `gas-cleanup/cleanup.gs` | GAS — private web-app admin page (`doGet`) to review and delete expired events. Its own GAS project (script ID `1EsOw-Ur4TdGC5ObVlXyX_ouSvvfm9ByN3TkxaTT0ftTBXLuXLzrOXsEZ`, own `.clasp.json`/`appsscript.json` in `gas-cleanup/`). It is the **only** GAS project in this repo. Runs as a manually-opened admin tool. |
| `icons/favicon.svg` | App favicon (calendar + checkmark icon) |
| `icons/` | Icon set: `icon-16/32/64/128/256/512.svg`, `logo-wordmark.svg`, `logo-wordmark-light.svg` |
| `CNAME` | Domain record — `whenfree.org` |
| `help.html` | Help page |
| `terms.html` | Terms & Privacy page |
| `accessibility-statement.html` | Accessibility statement |
| `404.html` | GitHub Pages custom 404 |
| `pad.xml` | ASP PAD 4.0 descriptor for software directory submissions (Softpedia, etc.) — self-hosted at `whenfree.org/pad.xml` |
| `Screenshots/` | Listing screenshots: `0.png` (creation form), `1.png` (grid + best times — used as PAD hero image), `2.png` (mobile crop) |

## Domain & Redirects

- **Live site:** `whenfree.org` → GitHub Pages (Cloudflare DNS)
- **Legacy redirect:** `meet.meteor.co.il` → `whenfree.org` via Cloudflare Redirect Rule (Dynamic, preserves query string)
- **Cleanup admin shortcut:** `cleanup.whenfree.org` → private expired-meeting cleanup page, served by the standalone `gas-cleanup` GAS project (script ID `1EsOw-Ur4TdGC5ObVlXyX_ouSvvfm9ByN3TkxaTT0ftTBXLuXLzrOXsEZ`; see GAS Deployment), with `ADMIN_TOKEN` baked into the rule's target. Cloudflare Redirect Rule (Wildcard, 302) on a dedicated proxied DNS record (`A` → `192.0.2.1`, a reserved placeholder IP — the redirect fires before that IP is ever reached). Kept on its own subdomain so the apex `whenfree.org` record stays DNS-only, which GitHub Pages' TLS handling needs. If `ADMIN_TOKEN` is ever rotated in GAS Script Properties, or the `gas-cleanup` project is ever redeployed to a new deployment ID, this rule's target URL must be updated to match.
- **Email forwarding (incoming):** Cloudflare Email Routing catch-all → `avi.klayman@gmail.com`
- **Email sending (outgoing):** ZeptoMail transactional API from `no-reply@whenfree.org` (via the `sendMail` Cloud Function, `functions/index.js`)
- **Contact:** `avi@whenfree.org`

## Software Directory Listings (PAD)

- `pad.xml` — ASP PAD 4.0 descriptor for submitting WhenFree to Softpedia and similar software directories. Self-hosted at `https://whenfree.org/pad.xml` (its own `Application_XML_File_URL` points back to itself, per PAD convention). Submit by pasting that URL into a directory's PAD/submit-software form.
- **Legal/company info used:** `Company_Name`=`Klayman Meteor Ltd.`, address `5 Snir St., Ramat-Hasharon, Israel 4704071`, contact `avi@whenfree.org` — reuse this if other directories need company info.
- **Web-app caveat:** PAD was designed for downloadable installers; WhenFree has none, so `File_Info` sizes are `0` and `Primary_Download_URL` points at the homepage itself rather than an installer file. `Program_OS_Support` lists broad desktop/mobile OSes as an approximation since the spec has no literal "Web" value.
- **Hero screenshot:** `Screenshots/1.png` (grid + ranked best times) is used as `Application_Screenshot_URL` — most representative of the product's value prop.
- To update: edit `pad.xml`, commit, push — live within ~a minute via GitHub Pages.

## Features

- **Real-time sync:** Firestore backend syncs availability across all participants
- **Ranked best times:** Algorithm ranks time slots by number of "available" votes
- **Add to Calendar:** Google Calendar deep-link, Outlook web deep-link (`outlook.live.com/.../compose?rru=addevent`), or `.ics` download (Apple + other apps). Handles `specific` and `days` modes. All three paths use UTC times computed by `wallTimeToUtc()` — the `.ics` emits `DTSTART:...Z` (no `TZID`; Outlook desktop rejects/shifts undefined TZIDs), and the Google URL uses `dates=...Z/...Z` (no `ctz`). Do not reintroduce `TZID` lines or local-time Google dates (see the midnight-bug entry in docs/incident-history.md).
- **Per-user colors:** Each participant gets a color for easy identification
- **Dark/light toggle:** Theme switcher with localStorage persistence
- **i18n:** English, Hebrew (RTL), French — toggled via buttons or `?lang=` URL param
- **Language URL params:** `?lang=fr`, `?lang=he`, `?lang=en` — detected on load, updated in URL on change. Works with event hashes: `whenfree.org/?lang=fr#eventSlug`
- **No login required:** Share a link, participants add their name and availability
- **Daily DB report:** Automated midnight email with Firestore event count, reads/writes/deletes vs. free-tier limits, storage usage, and a link (`https://cleanup.whenfree.org/`) to the expired-meeting cleanup page — the short URL means `ADMIN_TOKEN` no longer needs to appear in the email body at all (Cloudflare's redirect rule carries it server-side). Sent by the `dailyReport` Cloud Function on a Cloud Scheduler cron (see Cloud Functions Deployment), not GAS.
- **Smart disabled states:** `syncActionStates()` disables "Send best times" when no slots exist; re-enables reactively
- **Floating email panels:** Email input panels use `position:fixed` (no layout shift when opened)
- **Onboarding lang picker:** First-time visitors see EN/FR/HE buttons at the top of the help modal — clicking one calls `setLang()` and re-renders the modal content instantly in the chosen language before the user reads it
- **Viewer-local timezone annotation:** The grid is always rendered in the single event-level `S.timezone` (set once by the creator — cell identity is `col:row` grid-position indices, not absolute timestamps, so there's no per-viewer grid reflow). To reduce cross-timezone confusion without touching that data model, `buildGrid()` detects the viewer's browser timezone (`getViewerTz()`) and, only when it differs from `S.timezone`: shows a two-line header above the grid (line 1 "Times shown in X.", line 2 "Your local time zone is Y." — localized EN/FR/HE, `tzShownIn`/`tzYourLocal` i18n keys) and adds a second time-label column to the grid itself. Each timezone's column is headed by its `GMT±H` offset (`.grid-tz-col-head`/`.grid-tz-col-head-viewer`, from `tzAbbrev()`'s `'shortOffset'` mode — not `'short'`, which only returns letter codes like `EDT` for a handful of US zones and falls back to `GMT±H` for everything else, so forcing offset mode keeps the format uniform across all timezones) and holds only that timezone's single time value per row (`.grid-time-label` / `.grid-time-label-viewer`) — no concatenated strings, so the two-columns-not-one-string design also sidesteps the bidi-reordering class of bug entirely (see RTL gotcha below). Purely a display-layer addition — no Firestore/storage changes. Known limitation: in recurring "days of week" mode there's no calendar date, so a slot near midnight can shift to a different weekday for the viewer without the column label reflecting that.

## Email System

- **Sender:** ZeptoMail transactional API, called via four Firebase Cloud Functions (`functions/index.js`: `sendMail`, `storeCreatorEmail`, `notifyOrganizer`, `dailyReport`). `index.html` calls `sendMail` via `fetch()` (`sendEmailViaGAS()`, despite the name — historical name from when it called a GAS web app). `dailyReport` sends its own report/failure-alert mail by calling the module's `sendViaZepto_()`/`buildZeptoPayload()` helpers directly (in-process, no HTTP hop through `sendMail`, and notably **not** subject to `sendMail`'s per-event rate cap below — see that entry). `sendMail`/`storeCreatorEmail`/`notifyOrganizer` pass/check an `X-WhenFree-Key` header for a light abuse-deterrent check (`checkAuth()`) — not a real secret, the key is a public constant shipped in `index.html` (`WHENFREE_MAIL_KEY`). `dailyReport` has no such header check; it's gated by Cloud Scheduler's IAM/OIDC auth instead (see Cloud Functions Deployment).
- **Endpoint:** `https://api.zeptomail.com/v1.1/email` (US region) — called server-side by the Cloud Functions only.
- **Auth:** `Authorization: <ZEPTO_API_KEY>` — read via `process.env.ZEPTO_API_KEY` in the Cloud Functions (Secret Manager, bound via `--set-secrets` at deploy time — see Cloud Functions Deployment). Never in source code.
- **Per-event send cap:** `checkAndIncrementMailCount_()` in `functions/index.js` caps sends to 100/day per `event_slug` (tracked in `mailCounts/{slug}`, a Firestore collection closed to client reads) — mitigates using the mail relay for bulk spam without restricting recipients, since the invite/best-times panels intentionally let users email arbitrary addresses (a real feature, not a bug). Fails open on any Firestore error so a rate-limiter hiccup can never block real mail delivery. Only `sendMail` and `notifyOrganizer` go through this cap; `dailyReport` bypasses it entirely by calling `sendViaZepto_()` directly (see above) — this is safe only because `dailyReport` has no public caller (Scheduler-only, IAM-gated). The fallback bucket for requests with no `event_slug` is named `unknown`, **not** `__unknown__` (see the reserved-document-ID rule in Security Patterns).
- **Organizer email storage:** the organizer's email is **not** stored on the public `events/{slug}` document (`allow read: if true` makes that document world-readable). `createEvent()` in `index.html` calls `storeCreatorEmail` right after creating the event, which verifies the request's `creatorToken` matches the event doc, then writes the email into `eventSecrets/{slug}` — a collection with `allow read, write: if false` in Firestore rules, reachable only via the Cloud Functions' Admin SDK (which bypasses rules). See the Security Patterns entry below.
- **Template:** `buildEmailTemplate(bodyHtml, dir)` — dark forest header with calendar-check icon + "WhenFree" wordmark, verde palette card, sage background
- **Email types:** creator confirmation, invite to mark availability, best times, organizer notification (all localized EN/HE/FR with RTL support)
- **Organizer notification:** `scheduleNotifyOrganizer(name)` — debounced 120s after last cell mark (not on join) — calls `fireNotifyOrganizer()`, which posts to the `notifyOrganizer` Cloud Function (`eventSlug` + pre-built subject/body only, no email address) rather than sending client-side. Sends branded HTML with participant avatar initial chip.
- **ICS UID format:** `${eventSlug}-${Date.now()}@whenfree.org`

## Key Functions

| Function | Purpose |
|----------|---------|
| `renderBestTimes()` | Scores and ranks time slots; populates `S.bestSlots` |
| `syncActionStates()` | Disables/enables sidebar buttons based on data state |
| `openCalModal(i)` | Opens "Add to Calendar" modal for `S.bestSlots[i]` |
| `wallTimeToUtc(y, m, d, mins, tz)` | Converts wall-clock time in an IANA timezone to a UTC `Date` via `Intl.DateTimeFormat` (2-pass correction for DST edges; `hourCycle:'h23'` — `hour12:false` can render midnight as "24"). `mins >= 1440` rolls to next day. |
| `buildCalDate(slot)` | Converts slot data to local `YYYYMMDD`/`HHMMSS` strings plus UTC forms: `startUtc`/`endUtc` (ICS `YYYYMMDDTHHMMSSZ`) and `startIso`/`endIso` (for the Outlook URL) |
| `downloadIcs(slot, startUtc, endUtc)` | Generates RFC 5545 `.ics` blob (UTC `DTSTART`/`DTEND`) and triggers download |
| `buildEmailTemplate(bodyHtml, dir)` | Wraps email content in branded HTML template |
| `buildBestTimesEmailHtml()` | Builds localized best-times email (uses `currentLang`) |
| `scheduleNotifyOrganizer(name)` | Debounced (120s) notification to creator when a participant marks cells — only fires on cell marks, not on join |
| `storeCreatorEmail(eventSlug, creatorEmail, creatorToken)` | Posts the organizer's email to the `storeCreatorEmail` Cloud Function right after event creation, so it lands in `eventSecrets/{slug}` instead of the public event doc |
| `toggleEmailPanel(panelId, btnId, otherPanelId)` | Opens/closes floating email input panels via `position:fixed` |
| `setLang(code)` | Sets language, updates localStorage and URL (`?lang=`) |
| `getViewerTz()` | Returns the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) |
| `refDateForWeekday(dayLabel)` | Resolves a "days" mode weekday label to the next upcoming calendar date — shared by `buildCalDate()` and the grid's viewer-tz row-label conversion |
| `tzFullName(tz, refDate)` | Long localized timezone name (e.g. "Central European Summer Time") via `Intl.DateTimeFormat(..., {timeZoneName:'long'})`, used in the grid's tz header |
| `minsToViewerLabel(refDate, mins, viewerTz)` | Converts an event-tz wall-clock minutes value to the viewer's local-time label string, via `wallTimeToUtc()` |

## SVG Icon Constants

Button icons declared before `const LANGS`:

```js
const _AR = `<svg ...right arrow...>`;  // LTR forward
const _AL = `<svg ...left arrow...>`;   // LTR back / RTL forward
const _X  = `<svg ...× close...>`;      // dismiss / clear
const _LINK = `<svg ...link icon...>`;  // copy link
```

Use in i18n strings (template literals) rather than Unicode entities.

## Key Details

- **Framework:** Vanilla JS (no build step)
- **Database:** Firebase Firestore (project: `meteor-meet`)
- **Styling:** CSS custom properties (variables), Verde design system
- **Time format:** 24-hour everywhere (`ampm:false` in all `LANGS` entries)
- **No backend** — all logic in `index.html` (Firebase rules handle authorization)
- **Firebase plan:** Blaze (pay-as-you-go) — needed for Cloud Monitoring API. Actual cost: ~$0.
- **Firebase project ID:** `meteor-meet` — **permanent, cannot be renamed.** The ID is hardcoded in the SDK config (`projectId:"meteor-meet"`), all Firestore URLs, and the Cloud Functions' console links. Only the display name in Firebase Console can be changed cosmetically. Creating a new project would require full data migration — do not suggest it.
- **`.gitignore`:** `.claude/*` is ignored except shared config (`settings.json`, `hooks/`, `skills/`, `agents/`), which is committed. `.claude/settings.local.json` stays ignored — never commit it (personal permissions).

## Firestore Event Fields

Each event document stores:
- `createdAt` — Firestore server timestamp (older events lack this field)
- `lastDate` — ISO date string of the latest date in `selectedDates` (e.g. `"2026-07-15"`); `null` for `days` mode events (recurring days of week have no end date)

**Does not store `creatorEmail`** — it lives in the separate `eventSecrets/{slug}` collection instead (`{creatorEmail}`, one doc per event, `allow read, write: if false`), written by the `storeCreatorEmail` Cloud Function. `events` docs created before 2026-08-19 should have no residual field either.

**`mailCounts/{slug}`** — one doc per event, `{date, count}`, used only by the Cloud Functions' per-event send-rate cap (see Email System). Also `allow read, write: if false`.

**Cleanup tool:** `cleanup.gs` provides a private admin web page to review candidates and delete them after typing a confirm phrase. It flags two buckets: (1) dated events where `lastDate` < today, (2) recurring (`days` mode, `lastDate == null`) events with no `createdAt` for 90+ days. Caveat: events created before June 2026 predate `createdAt` entirely, so old abandoned recurring events from before then won't surface automatically — review those manually in Firestore Console. Manual fallback (still valid): Firestore Console → `events` → filter `lastDate` < today.

## RTL / Layout Architecture

- **`.top-controls`** (desktop lang+theme bar): `position:fixed; left:16px; direction:ltr; transform:translateX(calc(100vw - 100% - 32px)); transition:transform 0.35s ease` — appears at top-right in LTR. `[dir="rtl"] .top-controls{transform:none}` slides it to top-left on Hebrew.
- **`.mobile-top-bar`** and **`.top-controls`**: both have `direction:ltr` to prevent internal flex reorder in RTL.
- **Mobile controls visibility**: `#top-controls` shows on Screen A (mobile). Hidden via JS in both `transitionToB()` and `showScreenB()` when `window.innerWidth <= 640`. Never use CSS `display:none` to hide it globally.
- **Name overlay (join dialog)**: `position:fixed` inside `@media(max-width:640px)` — needed because `#screen-event` has `height:auto` on mobile, making `position:absolute;inset:0` center off-screen.
- **Touch detection**: `navigator.maxTouchPoints > 0` in `applyLang()` swaps `markSub`→`markSubMobile` and `gridHint`→`gridHintMobile` (tap vs drag/click wording).
- **Onboarding modal header**: `.onboard-header` is a `display:flex; justify-content:space-between` row containing `.onboard-lang` (the EN/FR/HE pill) and `.onboard-close` (the ✕ button). The close button is **not** `position:absolute` — it's in normal flow inside the header. Do not make it absolute again; that causes overlap with the lang pill.
- **Multiple LTR fragments in one RTL text node get reordered**: under `dir="rtl"`, the bidi algorithm reorders two or more LTR tokens joined into one text node (e.g. `09:00 · 10:00` renders as `10:00 · 09:00`), even when each fragment renders correctly alone. Use separate elements instead of concatenation. `.grid-time-label` keeps `direction:ltr` as a defensive baseline. Watch for this pattern anywhere two+ LTR tokens are joined into one string inside an RTL-rendered element.

## Firestore Security Rules

Live rules (no longer Test Mode). Last changed 2026-08-19.

**Security model (no Firebase Auth):**
- `events/{slug}`:
  - `allow read: if true` — events are share-by-link; public reads are intentional
  - `allow create` — validates required fields, `participants == {}`, `creatorToken.size() >= 48`, `name.size() <= 200`. **Does not include `creatorEmail`** — do not add it back; that field no longer belongs on this doc (see Firestore Event Fields).
  - `allow update` — protects immutable fields (`creatorToken`, `createdAt`, `mode`, `selectedDates`, `selectedDays`, `earlierThan`, `laterThan`, `timezone`); only `participants` and `name` can change. If you ever add a field back to `events` that isn't meant to be updatable, add its immutability check here too — but never reference a field that a current-schema document might not have: `resource.data.foo` **throws** if `foo` doesn't exist on the doc, it does not evaluate to `null`.
  - `allow delete: if false` — no client-side event deletion
- `eventSecrets/{slug}` and `mailCounts/{slug}`: `allow read, write: if false` — fully closed to client SDKs, reachable only via the Cloud Functions' Admin SDK (which bypasses rules entirely). See Firestore Event Fields.
- Creator-only ops (remove participant, edit title) remain **client-gated only** — server enforcement requires Firebase Auth, which this app doesn't use

**To update rules:** Firebase Console → Firestore → Rules → Publish. No Firebase CLI is configured in this project.

**To verify deployed rules via CLI:**
```powershell
$TOKEN = gcloud auth print-access-token
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: meteor-meet" `
  "https://firebaserules.googleapis.com/v1/projects/meteor-meet/releases/cloud.firestore"
# Then fetch the rulesetName returned above:
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: meteor-meet" `
  "https://firebaserules.googleapis.com/v1/{rulesetName}"
```

## Security Patterns

- **`escHtml()` is mandatory for all `innerHTML` injection** — any user-supplied string (participant name, event name, etc.) must go through `escHtml()` before being interpolated into an HTML template string. Using `textContent` is always safe and preferred; switch to `innerHTML` only when you need to embed tags (e.g. `<br>` between name parts). The `escHtml` helper is defined near the bottom of the script block.
- **Crypto tokens use `crypto.getRandomValues()`** — never `Math.random()` for anything used as a security identifier. Event slugs: `Uint8Array(5)` → base-36. Creator tokens: `Uint8Array(24)` → hex (192 bits).
- **Firebase scripts are in `<body>`** — the two Firebase CDN `<script>` tags live just before the inline app `<script>` (near line 1546), not in `<head>`. This prevents them from blocking initial HTML render. Do not move them back to `<head>`.
- **Mail Cloud Function has a shared-secret gate, not an open relay** — `functions/index.js`'s `sendMail`/`storeCreatorEmail`/`notifyOrganizer` all check an `X-WhenFree-Key` header (`checkAuth()`) and return 403 on mismatch. The key is a public constant in `index.html` (not a real secret — it's shipped to every browser), so this is a light abuse-deterrent, not strong auth. `to_email` on `sendMail` is still deliberately unrestricted once the header matches — the invite/best-times panels legitimately email arbitrary addresses, so a recipient allowlist isn't viable; the actual abuse mitigation is the per-event daily send cap (see Email System).
- **Organizer email is private data** — any creator-only or private field must go into `eventSecrets` (or a similar closed collection), never onto `events`. Firestore has no field-level read rules, so anything on a publicly-readable document is fully public, regardless of whether the UI happens to only display it to the creator. `notifyOrganizer` looks the address up server-side; the client never sends it.
- **Firestore reserves document IDs matching `/^__.*__\$/`** (starts *and* ends with double underscore) — writes/reads against an ID like `__unknown__` or `__curl_test__` fail with `INVALID_ARGUMENT: ... reserved`. Do not use `__`-wrapped IDs for buckets or test documents.
- **Best-effort checks must never escape their try/catch.** Rate limiting, logging, and analytics sit inside a try/catch that fails open (rate limiter returns "under cap" on any Firestore error), so an unrelated failure there can never fail the whole request. Never place one of these checks outside the primary try/catch of a request handler.

## Event Listener Patterns

- **Click-outside handlers**: always use `el.contains(e.target)` not `e.target !== el` — SVG children inside a button will be the `e.target`, not the button itself.
- **mousedown + click double-fire**: on desktop, both `mousedown` and `click` fire for a single tap. To avoid double-toggling, `onCalDown` sets `calMousedownFired = true`; the `click` handler checks that flag and returns early if set. Mobile tap fires only `click` (no `mousedown`), so the click handler handles toggling directly. Pattern: `calDragMode` must always be set (based on current `S.selectedDates.has(dt)`) before calling `applyCalCell`.
- **Calendar drag**: `onCalDown` / `onCalEnter` are attached to each `.cal-cell` via `mousedown` / `mouseenter` in `renderMonthBlock`. Do not remove these — they enable desktop drag-select across multiple dates.

## GAS Deployment

**`gas-cleanup/` is the only GAS project in this repo.** Do not add a GAS time trigger for scheduled work. GAS user-OAuth triggers in this unverified app silently stop after about 7 days, so scheduled jobs belong in Cloud Scheduler + a Cloud Function (see Daily DB Report). Background: [docs/incident-history.md](docs/incident-history.md).

### gas-cleanup project (cleanup.gs)

`https://script.google.com/d/1EsOw-Ur4TdGC5ObVlXyX_ouSvvfm9ByN3TkxaTT0ftTBXLuXLzrOXsEZ/edit` — pushed from `projects/whenfree/gas-cleanup/` (its own `.clasp.json`; excluded from the root project's push via `gas-cleanup/**` in the root `.claspignore`). `oauthScopes`: `script.external_request`, `datastore` (the scope that caused the project split — `deleteEvents()` needs a real Firestore OAuth Bearer token to delete documents).

```powershell
cd projects/whenfree/gas-cleanup
clasp push --force && clasp deploy --deploymentId AKfycby8owVTRjHWRZOO3EjcXk4lB4H8Gw5LmCH12O2HdhamuQMeh1rXRvb3ZEYVJkceNOs-5w
```

- Admin cleanup deployment ID: `AKfycby8owVTRjHWRZOO3EjcXk4lB4H8Gw5LmCH12O2HdhamuQMeh1rXRvb3ZEYVJkceNOs-5w` @1 — serves `cleanup.gs`'s `doGet` (Execute as: Me, Access: Anyone — the `ADMIN_TOKEN` check inside `doGet` is the real gate). Raw URL: `https://script.google.com/macros/s/AKfycby8owVTRjHWRZOO3EjcXk4lB4H8Gw5LmCH12O2HdhamuQMeh1rXRvb3ZEYVJkceNOs-5w/exec?token=<ADMIN_TOKEN>` (token stored in this project's own Script Properties as `ADMIN_TOKEN`, also needs `API_KEY`) — but use the short `https://cleanup.whenfree.org/` link day-to-day (see Domain & Redirects). The `API_KEY` property must hold the **same** Firebase web key as `index.html`'s `firebaseConfig.apiKey`. If the web key is ever rotated, update this property before deleting the old key from GCP. If this deployment is ever recreated (new deployment ID), the Cloudflare redirect rule's target URL must be updated to match.

## Cloud Functions Deployment

No Firebase CLI configured in this project — deploy via `gcloud`, one command per function (all four share `functions/` as source; only `--entry-point` differs). Each deploy triggers a Cloud Build that runs `npm install` from `functions/package.json` automatically — no manual install step needed before deploying. Redeploy **every** function that shares `functions/index.js` whenever that file changes, not just the one you're adding/fixing.

```powershell
gcloud functions deploy sendMail --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --allow-unauthenticated --source=functions/ --entry-point=sendMail `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,WHENFREE_MAIL_KEY=whenfree-mail-key:latest' `
  --max-instances=5 --project=meteor-meet

gcloud functions deploy storeCreatorEmail --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --allow-unauthenticated --source=functions/ --entry-point=storeCreatorEmail `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,WHENFREE_MAIL_KEY=whenfree-mail-key:latest' `
  --max-instances=5 --project=meteor-meet

gcloud functions deploy notifyOrganizer --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --allow-unauthenticated --source=functions/ --entry-point=notifyOrganizer `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,WHENFREE_MAIL_KEY=whenfree-mail-key:latest' `
  --max-instances=5 --project=meteor-meet

gcloud functions deploy dailyReport --gen2 --runtime=nodejs20 --region=us-central1 `
  --trigger-http --no-allow-unauthenticated --source=functions/ --entry-point=dailyReport `
  --set-secrets='ZEPTO_API_KEY=zepto-api-key:latest,HEALTHCHECK_PING_URL=healthcheck-ping-url:latest' `
  --max-instances=2 --project=meteor-meet
```

`--allow-unauthenticated` is required for `sendMail`/`storeCreatorEmail`/`notifyOrganizer` since real browsers call them directly — the `X-WhenFree-Key` header check inside each is the actual gate, not IAM. `dailyReport` is the odd one out: it's deployed `--no-allow-unauthenticated` since its only legitimate caller is Cloud Scheduler, so IAM/OIDC is the gate instead (see Daily DB Report below). All four run as `935791631512-compute@developer.gserviceaccount.com` (the default compute service account, which holds project-level `roles/editor` — confirmed sufficient for Firestore Admin SDK access and Cloud Monitoring reads; no extra IAM binding needed for any of the four functions' data access).

**Quick isolated verification** (before touching the client) — expect `403 forbidden`, proves auth + Firestore lookup work without touching real data:
```powershell
curl -i -X POST https://us-central1-meteor-meet.cloudfunctions.net/storeCreatorEmail `
  -H "Content-Type: text/plain" -H "X-WhenFree-Key: <WHENFREE_MAIL_KEY value>" `
  -d '{\"eventSlug\":\"sometestslug123\",\"creatorEmail\":\"test@example.com\",\"creatorToken\":\"bad-token\"}'
```
Avoid `__`-wrapped test IDs (e.g. `__curl_test__`) — see the reserved-document-ID rule in Security Patterns.

## Daily DB Report (`dailyReport` Cloud Function + Cloud Scheduler)

Sends the nightly DB usage report — Firestore event count, reads/writes/deletes vs. free-tier limits, storage usage — to `avi.klayman@gmail.com`. Runs as the `dailyReport` Cloud Function (see Cloud Functions Deployment) on a Cloud Scheduler cron.

**Scheduler job:**
```powershell
gcloud scheduler jobs create http dailyReport `
  --schedule="0 0 * * *" --time-zone="Asia/Jerusalem" `
  --uri="https://us-central1-meteor-meet.cloudfunctions.net/dailyReport" `
  --http-method=POST `
  --oidc-service-account-email="935791631512-compute@developer.gserviceaccount.com" `
  --location=us-central1 --project=meteor-meet
```
The function must also grant that same service account `roles/run.invoker`: `gcloud functions add-invoker-policy-binding dailyReport --region=us-central1 --project=meteor-meet --member="serviceAccount:935791631512-compute@developer.gserviceaccount.com"`. To manually trigger a run for testing: `gcloud scheduler jobs run dailyReport --location=us-central1 --project=meteor-meet`, then check `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="dailyreport"' --project=meteor-meet --freshness=1h` (note: `gcloud functions logs read` lags/misses gen2 stdout — use `gcloud logging read` against the Cloud Run revision instead).

**Monitoring:** a healthchecks.io check ("WhenFree Daily Report") pings on every run — plain ping on success, `/fail` suffix on error — via `pingHealthcheck_()` in `functions/index.js`. Its ping URL lives in Secret Manager as `healthcheck-ping-url` (bound to `HEALTHCHECK_PING_URL` at deploy time), never in source/docs. Because it alerts on a *missed* ping, it still catches the function silently failing to run at all, not just failing loudly.

**Why not GAS:** GAS user-OAuth triggers in this unverified app expire on about a 7-day cadence regardless of declared scopes, and the trigger goes silent with no error. That is why the report runs on Cloud Scheduler + a Cloud Function. Full history: [docs/incident-history.md](docs/incident-history.md).

**Watch for:** if the nightly report/ping ever goes silent, check Cloud Scheduler's own execution history first (`gcloud logging read 'resource.type="cloud_scheduler_job"' --project=meteor-meet --freshness=2d`) and the function's own logs before assuming a cause. OAuth expiry cannot apply to this function.

## Design System — Verde (Material 3-aligned)

### Color Palette

**Light Mode**
- `--bg: #D6EDE4` — page background (saturated mint)
- `--surface: #E9F6F0` — cards, panels
- `--surface2: #D6EDE4` — secondary surface
- `--text: #0B2018` — primary text
- `--muted: #3E5750` — secondary text
- `--muted2: #7E988F` — tertiary text
- `--accent: #00C281` — primary green
- `--primary-ctr: #C7F4E2` — tonal container
- `--on-primary-ctr: #00382A` — text on tonal container
- `--on-primary: #04261B` — text on accent buttons
- `--border: rgba(10, 70, 52, 0.15)` / `--border2: rgba(10, 70, 52, 0.20)`
- `--cell-empty: #ECF8F2` — empty grid cell fill (lighter than bg for clear affordance)

**Dark Mode**
- `--bg: #081C13` — page background
- `--surface: #0F2A1E` / `--surface2: #163526`
- `--text: #D6F0E6` / `--muted: #81B09A` / `--muted2: #5A7D6E`
- `--accent: #00D68F`
- `--primary-ctr: #1A4D38` / `--on-primary-ctr: #7FDBBA`
- `--cell-empty: #1C3D2C` — empty grid cell fill; cells also get `border: 1.5px solid rgba(100,210,160,0.14)` override for shape definition

**Heatmap:** `--heat-1` through `--heat-5` (light → dark variants per mode)

### Typography
- **Display:** `'Figtree', system-ui` — headings, 600–700 weight
- **Body:** `'DM Sans', system-ui` — content, 400–500 weight

### Border Radius
- `--r: 22px` / `--r-sm: 14px` / `--r-xs: 6px` / `--r-pill: 100px`

### i18n
- All strings in `LANGS` object (`en`, `he`, `fr`)
- Language detection: `?lang=` query param → URL path `/en|fr|he` → localStorage → default `en`
- `setLang(code)` updates URL via `history.replaceState`
- Hebrew RTL: `direction:rtl` + `text-align:right` on email content cells (email clients ignore `<html dir>`)
