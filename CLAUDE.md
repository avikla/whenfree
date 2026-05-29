# Meteor — Project Context

## Overview

Single-file meeting scheduler (when2meet alternative). Real-time availability sync via Firebase Firestore, ranked best-time finder, per-user colors, dark/light mode toggle, and Hebrew RTL email support. Hosted at `meet.meteor.co.il`.

## Repository & Deployment

**Git submodule** pointing to `avikla/Meteor-Meet`:
- GitHub: https://github.com/avikla/Meteor-Meet
- Local path: `projects/Meteor-Meeting-Scheduler/`
- Deployment: GitHub Pages (automatic on push to `avikla/Meteor-Meet`)

Push changes **from inside the submodule** to avoid merge conflicts:

```powershell
cd "projects/Meteor-Meeting-Scheduler"
git add .
git commit -m "..."
git push
```

After pushing from the submodule, return to workspace root and the submodule pointer will auto-update on next commit.

## Files & Architecture

| File | Role |
|------|------|
| `index.html` | Single-page app (HTML, CSS, JS inline) with Firebase Firestore integration |
| `mailer.gs` | Google Apps Script for sending meeting invite emails from `no-reply@meteor.co.il` |
| `favicon.svg` | App icon |
| `CNAME` | Domain record for `meet.meteor.co.il` |

## Features

- **Real-time sync:** Firestore backend syncs availability across all participants
- **Ranked best times:** Algorithm ranks time slots by number of "available" votes
- **Per-user colors:** Each participant gets a color for easy identification
- **Dark/light toggle:** Theme switcher with localStorage persistence
- **Hebrew RTL:** Email invites support Hebrew text with proper RTL formatting
- **No login required:** Share a link, participants add their name and availability

## Deployment & Usage

### Website

```powershell
cd "projects/Meteor-Meeting-Scheduler"
git push  # deploys to meet.meteor.co.il via GitHub Pages
```

- Live immediately after push
- Domain: `meet.meteor.co.il` (CNAME → avikla.github.io)

### Email notifications (GAS mailer)

The mailer is a standalone GAS Web App that sends meeting invites:

**Call from JavaScript:**
```javascript
fetch(MAILER_URL, {
  method: 'POST',
  payload: JSON.stringify({
    to_email: 'user@example.com',
    event_name: 'Team sync',
    meeting_url: 'https://meet.meteor.co.il/abc123',
    subject: 'Meeting invite',
    html_body: '<p>...</p>'
  })
});
```

**Script Properties (set once in GAS editor):**
- `MAILER_URL` — GAS Web App deployment URL (embedded in the app)

## Key Details

- **Framework:** Vanilla JS (no build step)
- **Database:** Firebase Firestore (real-time sync, auto-scaling)
- **Email:** GAS `GmailApp.sendEmail()` with HTML body support
- **Styling:** CSS-in-JS, CSS custom properties (variables)
- **Time format:** 24-hour, ISO dates
- **No backend code** — all logic in `index.html` (Firebase rules handle authorization)

## Firebase Configuration

Embedded in `index.html`:

```javascript
const firebaseConfig = { ... };
firebase.initializeApp(firebaseConfig);
```

Collection: `meetings` → documents with participant availability maps

## Development Notes

- No local dev server needed — just open `index.html` in browser (requires HTTPS for Firestore in production)
- Changes to `index.html` are live after push
- `mailer.gs` is independent — update via clasp if changes needed
