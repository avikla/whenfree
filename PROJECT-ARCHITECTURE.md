# WhenFree — Project Architecture & Services

Last updated: June 2026

---

## Hosting & Deployment

**GitHub** (`github.com/avikla/whenfree`)
Source code repository. Every `git push` to `main` triggers an automatic GitHub Pages deployment. No CI/CD config needed — Pages detects the static files automatically.

**GitHub Pages**
Serves the live app at `whenfree.org`. Hosts all static files: `index.html`, `terms.html`, `help.html`, `accessibility-statement.html`, `404.html`, icons. Zero cost, zero server management.

---

## Database & Real-time Sync

**Firebase Firestore** (project ID: `meteor-meet`)
Cloud NoSQL database. Stores all meeting data: event name, date/time ranges, participants, availability grids, creator info, notification preferences. Firestore's real-time listeners (`onSnapshot`) power live sync — when one participant marks a cell, all other participants see it instantly without polling. Plan: Blaze (pay-as-you-go), actual cost ~$0.

---

## DNS & Network

**Cloudflare**
Three distinct roles:
- **DNS** — authoritative nameserver for `whenfree.org`. Hosts A records (→ GitHub Pages IPs), CNAME records (Brevo DKIM, `www`), MX records (Email Routing), TXT records (SPF, DMARC, Brevo verification)
- **Email Routing** — catch-all rule forwards any incoming `*@whenfree.org` email to `avi.klayman@gmail.com`. This is receive-only (no SMTP sending)
- **Redirect Rule** — Dynamic redirect rule that forwards `meet.meteor.co.il/*` → `whenfree.org/*`, preserving the full query string (legacy domain from when the app was called Meteor Meet)

---

## Email Sending

**ZeptoMail** (zeptomail.com)
Transactional email API. Sends all 4 outgoing email types from `no-reply@whenfree.org`:
1. **Creator confirmation** — "Your meeting link" sent when a meeting is created
2. **Participant invite** — sent when organizer uses the "Email meeting link" panel
3. **Best times** — sent to participants showing ranked available slots
4. **Organizer notification** — "X responded to your meeting" sent 120s after a participant's last cell mark

Endpoint: `https://api.zeptomail.com/v1.1/email` (US region). Auth: `Authorization: Zoho-enczapikey <token>` — full token (including `Zoho-enczapikey` prefix) stored in GAS Script Properties as `ZEPTO_API_KEY` and used directly. On failure, a GmailApp alert is sent to `avi.klayman@gmail.com`.

**Google Apps Script (GAS)**
Serverless middleware between the frontend and ZeptoMail. The app (`index.html`) can't call ZeptoMail directly (CORS + API key exposure), so it POSTs to the GAS web app URL (`mailer.gs`), which then calls ZeptoMail's API via `UrlFetchApp.fetch()`. Also hosts `daily-report.gs` — a nightly cron that queries Firestore's REST API and emails a usage report (reads/writes/deletes vs. free-tier limits) to `avi.klayman@gmail.com`.

GAS project: `https://script.google.com/d/1MCoKYf2EVaueAzpjWAmHdvzubUcj3NqLAXzrBic6oRZgxacpnf44uYBD/edit`

---

## Development Tools

**clasp** (Command Line Apps Script)
Google's CLI for pushing local `.gs` files to GAS:
```powershell
clasp push --force
```
One-command push + deploy (no GAS editor needed):
```powershell
clasp push --force && clasp deploy --deploymentId AKfycbz7hknVlxm_K7RdFBV1gd7MbBz3KYsq7PQ2UgqHHByTxM2PI2W21T8p3sZ6qIenPMPDNg
```

---

## Fonts & Design

**Google Fonts**
Serves two typefaces used throughout the app and static pages:
- **Figtree** (600–700 weight) — display/headings
- **DM Sans** (400–500 weight) — body text

---

## Domain Registrar

**Squarespace**
Registrar only — holds the `whenfree.org` domain registration. DNS is delegated entirely to Cloudflare. No other Squarespace services are used.

---

## Architecture Diagram

```
User browser
    │
    ├── index.html (GitHub Pages)
    │       │
    │       ├── Firebase Firestore ──── real-time availability sync
    │       │
    │       └── GAS mailer URL (POST)
    │               │
    │               └── mailer.gs (Google Apps Script)
    │                       │
    │                       └── ZeptoMail API  no-reply@whenfree.org
    │
whenfree.org
    │
    ├── Cloudflare DNS
    │       ├── A records → GitHub Pages
    │       ├── MX records → Cloudflare Email Routing → avi.klayman@gmail.com
    │       └── meet.meteor.co.il → redirect → whenfree.org
    │
    └── Squarespace (registrar only)
```
