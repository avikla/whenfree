# Meteor — Project Context

## Overview

Single-file meeting scheduler (when2meet alternative). Real-time availability sync via Firebase Firestore, ranked best-time finder, per-user colors, dark/light mode toggle, and Hebrew RTL email support. Hosted at `meet.meteor.co.il`.

## Repository & Deployment

**Git submodule** pointing to `avikla/Meteor-Meet`:
- GitHub: https://github.com/avikla/Meteor-Meet
- Local path: `projects/meet-meteor/`
- Deployment: GitHub Pages (automatic on push to `avikla/Meteor-Meet`)

Push changes **from inside the submodule** to avoid merge conflicts:

```powershell
cd "projects/meet-meteor"
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
| `daily-report.gs` | Google Apps Script — sends a daily DB usage report email to `avi@meteor.co.il` at midnight IST |
| `appsscript.json` | GAS manifest — OAuth scopes, timezone (Asia/Jerusalem), runtime |
| `favicon.svg` | App icon |
| `CNAME` | Domain record for `meet.meteor.co.il` |
| `help.html` | Help page (linked from app footer) |
| `terms.html` | Terms & Privacy page (linked from app footer) |
| `accessibility-statement.html` | Accessibility statement (linked from app footer) |
| `404.html` | GitHub Pages custom 404 page |

## Features

- **Real-time sync:** Firestore backend syncs availability across all participants
- **Ranked best times:** Algorithm ranks time slots by number of "available" votes
- **Per-user colors:** Each participant gets a color for easy identification
- **Dark/light toggle:** Theme switcher with localStorage persistence
- **Hebrew RTL:** Email invites support Hebrew text with proper RTL formatting
- **No login required:** Share a link, participants add their name and availability
- **Daily DB report:** Automated midnight email to `avi@meteor.co.il` with Firestore event count, reads/writes/deletes vs. free-tier limits, and storage usage vs. 1 GiB limit

## Deployment & Usage

### Website

```powershell
cd "projects/meet-meteor"
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

### Daily DB report (GAS)

Runs at midnight IST via a GAS time-based trigger. Sends to `avi@meteor.co.il`.

**GAS project:** `https://script.google.com/d/1MCoKYf2EVaueAzpjWAmHdvzubUcj3NqLAXzrBic6oRZgxacpnf44uYBD/edit`

**Deploy changes:**
```powershell
clasp push --force
```

**One-time trigger install** (run once from GAS editor after any re-deploy):
- Select `createTrigger` → Run

**Metrics fetched:**
- Firestore REST API → total event count (no billing required)
- Cloud Monitoring API → reads/writes/deletes (requires Blaze plan — already enabled)
- Cloud Monitoring API → storage bytes (`firestore.googleapis.com/storage/data_and_index_storage_bytes`)

**Firebase plan:** Blaze (pay-as-you-go) — needed for Cloud Monitoring API. Actual cost: ~$0.

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

## Design System — Verde (Material 3-aligned)

### Color Palette

**Light Mode (default)**
- `--bg: #D6EDE4` — page background (saturated mint)
- `--surface: #E9F6F0` — cards, panels, containers
- `--surface2: #D6EDE4` — secondary surface
- `--text: #0B2018` — primary text (dark forest)
- `--muted: #3E5750` — secondary text, labels
- `--muted2: #7E988F` — tertiary text, hints
- `--accent: #00C281` — primary green (buttons, links, highlights)
- `--accent-text: #00C281` — same as accent (used for text contexts)
- `--accent-glow: rgba(0, 194, 129, 0.12)` — accent focus ring
- `--accent-dim: rgba(0, 194, 129, 0.28)` — accent divider/border tint
- `--primary-ctr: #C7F4E2` — tonal container (top ranked card background)
- `--on-primary-ctr: #00382A` — text on tonal container
- `--on-primary: #04261B` — text on accent buttons
- `--cell-empty: #DEEFE8` — empty calendar cell background
- `--border: rgba(10, 70, 52, 0.15)` — subtle green-tinted border
- `--border2: rgba(10, 70, 52, 0.20)` — stronger border

**Dark Mode (`[data-theme="dark"]`)**
- `--bg: #081C13` — page background (deep forest)
- `--surface: #0F2A1E` — cards, panels
- `--surface2: #163526` — secondary surface
- `--text: #D6F0E6` — primary text (light mint)
- `--muted: #81B09A` — secondary text
- `--muted2: #5A7D6E` — tertiary text
- `--accent: #00D68F` — brighter green for dark contrast
- `--accent-text: #00D68F` — same as accent (text contexts)
- `--accent-glow: rgba(0, 214, 143, 0.15)` — accent focus ring (dark)
- `--accent-dim: rgba(0, 214, 143, 0.25)` — accent divider/border tint (dark)
- `--primary-ctr: #1A4D38` — tonal container (darker variant)
- `--on-primary-ctr: #7FDBBA` — text on tonal container (light)
- `--on-primary: #04261B` — text on accent buttons (same as light)
- `--cell-empty: #163526` — empty calendar cell background
- `--border: rgba(200, 255, 230, 0.08)` — light mint border on dark bg
- `--border2: rgba(200, 255, 230, 0.14)` — stronger border on dark bg

**Heatmap Ramp (5-step density)**
- `--heat-1: #CBEFE0` → `#193828` (1/5 people free)
- `--heat-2: #97E2C4` → `#1B5840` (2/5)
- `--heat-3: #56D0A2` → `#1F7A59` (3/5)
- `--heat-4: #1FBE86` → `#1FBE86` (4/5 — same in both modes)
- `--heat-5: #079B6A` → `#00D68F` (5/5 everyone free)

### Typography

- **Display (headings):** `'Figtree', system-ui, sans-serif`
  - App title: 700 weight, 26–32px
  - Page headings: 700 weight, 28–30px
  - Section titles: 600 weight, 22–24px

- **Body (content):** `'DM Sans', system-ui, sans-serif`
  - Paragraph text: 400 weight, 15–16px
  - Labels/hints: 400 weight, 13–14px
  - Button text: 500 weight, 14px
  - Input placeholder: 400 weight, 15px

### Border Radius (Generous)

- `--r: 22px` — cards, panels, large containers
- `--r-sm: 14px` — input fields, small containers
- `--r-xs: 6px` — grid cells, small UI elements
- `--r-pill: 100px` — buttons, chips, badges, avatar circles

### Shadows & Depth

- Card shadow: `0 2px 16px rgba(10, 70, 52, 0.07)` (light) / `0 2px 16px rgba(200, 255, 230, 0.08)` (dark)
- Panel shadow: `0 32px 80px rgba(11, 32, 24, 0.12)` (light) / `0 32px 80px rgba(200, 255, 230, 0.08)` (dark)
- No grain overlay — clean surfaces only

### Component Rules

**Buttons**
- Primary (accent): `background: var(--accent); color: var(--on-primary); border-radius: var(--r-pill);`
- Hover: slight opacity reduction (0.9)
- Focus ring: `box-shadow: 0 0 0 3px var(--accent-glow)`
- Disabled: `opacity: 0.5; cursor: not-allowed`

**Input Fields**
- Background: `rgba(10, 70, 52, 0.04)` (light) or `rgba(200, 255, 230, 0.06)` (dark)
- Border: `1px solid var(--border)`
- Focus: `border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow)`
- Text: `color: var(--text); font-family: var(--font-body); font-size: 15px`

**Participant Badges**
- 36×36px circles with initials
- Background: `nameToColor(name)` (hue-based hash of name)
- Text: white, uppercase initials (first letter of first + last name)
- Shadow: `0 2px 8px rgba(10, 70, 52, 0.12)` (light) / `0 2px 8px rgba(0, 0, 0, 0.30)` (dark)
- Display: 2-row name below badge with proper sentence-case capitalization

**Calendar Grid**
- Cell size: 44×44px (touch-target minimum)
- Border: subtle `1px solid rgba(10, 70, 52, 0.10)` (visible but minimal)
- Empty cell: `background: rgba(10, 70, 52, 0.04)`
- Selected (click-only, no drag): `background: var(--heat-N)` based on density
- Interaction: **click to toggle**, no hover-select, no drag-select

**Best Times Card (Top Result)**
- Background: `var(--primary-ctr)` (tonal container)
- Border: `1px solid var(--accent-dim)`
- Title text: `var(--on-primary-ctr)` (high contrast on tonal bg)
- Availability bar: `var(--accent)` (bright green)
- Rank badge: `var(--accent)` text

**Name Overlay & Modal**
- Backdrop: `rgba(8, 28, 19, 0.50)` (dark forest with opacity)
- Panel background: `var(--surface)`
- Default display: `none` — only show when needed (not on creator auto-join)
- Fade transition: `opacity 0.4s ease`

**Theme Toggle Button**
- Shape: rounded pill `border-radius: var(--r-pill)`
- Active state: `color: var(--on-primary); background: var(--accent)`
- Inactive: `color: var(--muted); background: rgba(10, 70, 52, 0.06)`

### Interaction Patterns

- **Calendar selection:** Click only (no hover-select, no drag-select)
- **Creator auto-join:** When initiator creates event, name overlay doesn't flash — auto-joins silently
- **Name entry:** Only non-creators see the overlay; creators skip straight to grid
- **Rejoin existing:** If name already exists, show prompt to rejoin or pick new name
- **Best times:** Ranked by density (most free people first), highlighted with tonal container

### Spacing & Layout

- Card padding: 20–44px (depends on context)
- Sidebar width: 224px fixed
- Name panel width: 380px (90vw max on mobile)
- Grid gap: 1px (tight grid lines)
- Component gap: 6–20px (varies by section)
- Section padding: 28–44px

### Accessibility

- All interactive elements: ≥44×44px (touch target minimum)
- Text contrast: ≥4.5:1 (WCAG AA)
- Focus rings: visible (accent color glow)
- Color not sole indicator — text labels always present
- Placeholder text: gray (`var(--muted2)`)

### i18n Considerations

- Hebrew RTL support in emails via `direction: rtl` and proper text alignment
- All text strings in `i18n` object at top of script
- Font stack includes system fonts for multilingual support
- Time format: 24-hour (not locale-dependent in current build)
