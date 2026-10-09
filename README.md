# WhenFree

**Find the time. Finally.**

A lightweight meeting scheduler — no accounts, no back-and-forth, just a shared link. Built as a [when2meet](https://www.when2meet.com/) alternative with real-time sync, multilingual support, and a clean modern UI.

🌐 **Live at [whenfree.org](https://whenfree.org)**

---

## How it works

1. **Create an event** — name it, pick dates or days of the week, set a time range
2. **Share the link** — anyone with the link can join, no account needed
3. **Mark availability** — participants click or drag on the grid to show when they're free
4. **Find the best time** — the app ranks slots by how many people are available

---

## Features

- **Real-time sync** — Firestore backend; all participants see updates live
- **Ranked best times** — slots sorted by availability count, with Add to Calendar support (Google Cal + `.ics`)
- **Multilingual** — English, Hebrew (RTL), French; toggle or use `?lang=he` / `?lang=fr` in the URL
- **Dark / light mode** — persisted in localStorage
- **No login required** — organizer provides an email to receive the meeting link; participants just enter a name
- **Email notifications** — creator gets a confirmation email; optionally notified when someone responds
- **Send best times** — email a formatted summary of top slots to anyone
- **WhatsApp sharing** — one-click share link
- **Accessibility panel** — text size, high contrast, reduced motion, focus highlight, ADHD-friendly mode

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, HTML, CSS — single file (`index.html`), no build step |
| Database | Firebase Firestore (`meteor-meet` project) |
| Email | Firebase Cloud Functions (`functions/index.js`) → ZeptoMail API, sent from `no-reply@whenfree.org` |
| Hosting | GitHub Pages (`main` branch → `whenfree.org`) |
| Domain | `whenfree.org` via Cloudflare DNS + CNAME |

---

## Repository structure

```
index.html              # Full app — HTML, CSS, JS all inline
functions/index.js      # Cloud Functions: sendMail, storeCreatorEmail, notifyOrganizer, dailyReport
functions/index.test.js # Unit tests (npm test in functions/)
gas-cleanup/cleanup.gs  # Google Apps Script — private admin page to delete expired events (own GAS project)
icons/                  # SVG icon set (favicon, wordmark, sizes 16–512px)
help.html               # Help & FAQ page
terms.html              # Terms & Privacy page
accessibility-statement.html
404.html                # GitHub Pages custom 404
CNAME                   # whenfree.org
```

---

## Deployment

Push to `main` — GitHub Pages deploys automatically.

```powershell
git add .
git commit -m "..."
git push
```

For Cloud Functions changes, redeploy all four functions with `gcloud` (they share `functions/index.js`). See `CLAUDE.md` → Cloud Functions Deployment.

For the admin cleanup page (`gas-cleanup/`):

```powershell
cd gas-cleanup
clasp push --force
```

---

## Domain & email

| Purpose | Config |
|---|---|
| Live site | `whenfree.org` → GitHub Pages (Cloudflare DNS) |
| Legacy redirect | `meet.meteor.co.il` → `whenfree.org` via Cloudflare Dynamic Redirect Rule |
| Email forwarding (incoming) | `*@whenfree.org` → `avi.klayman@gmail.com` via Cloudflare Email Routing catch-all |
| Transactional email (outgoing) | ZeptoMail API, sent from `no-reply@whenfree.org` (via the `sendMail` Cloud Function) |
| Contact | [avi@whenfree.org](mailto:avi@whenfree.org) |

---

## Language support

All UI strings live in the `LANGS` object in `index.html` (`en`, `he`, `fr`). Detection order: `?lang=` URL param → localStorage → default `en`. Hebrew uses `dir="rtl"` throughout including email templates.

---

## License

© 2026 Avi Klayman. All rights reserved.
