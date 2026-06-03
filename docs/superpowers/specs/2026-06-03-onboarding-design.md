# Onboarding / Welcome Screen — Design Spec

**Date:** 2026-06-03  
**Status:** Approved

---

## Overview

Add a first-visit onboarding modal that explains how Meteor works to new users — both creators and participants. Repeat visitors are never shown it again. A persistent `?` button lets anyone re-open it on demand.

---

## Trigger Logic

- On every page load (both `#screen-create` and `#screen-event`), check `localStorage.getItem('meteor_onboarded')`.
- If the key is absent → show the modal after a **600ms delay** (allows the app to finish rendering first).
- If the key is present → skip silently.
- The `?` button always re-opens the modal regardless of the localStorage flag.
- Dismissing via "Got it" sets `localStorage.setItem('meteor_onboarded', '1')`.
- "Skip" also sets the flag and closes without animation emphasis.

---

## Modal Content

Title: **"How it works"** (i18n key: `onboardTitle`)

Three steps, each with an emoji icon, a short heading, and one body line:

| Step | Icon | Heading (i18n key) | Body (i18n key) |
|------|------|--------------------|-----------------|
| 1 | 📅 | `onboardStep1Title`: "Create an event" | `onboardStep1Body`: "Name it, pick dates and a time range, then share the link." |
| 2 | ✅ | `onboardStep2Title`: "Mark your availability" | `onboardStep2Body`: "Click cells on the grid to show when you're free." |
| 3 | ⭐ | `onboardStep3Title`: "Find the best time" | `onboardStep3Body`: "The app ranks slots by how many people are available." |

Footer actions:
- **"Got it →"** — primary accent button (`onboardGotIt`), dismisses + sets flag
- **"Skip"** — plain text link (`onboardSkip`), same dismiss behavior, no visual emphasis

---

## i18n Strings

All three languages need these keys: `onboardTitle`, `onboardStep1Title`, `onboardStep1Body`, `onboardStep2Title`, `onboardStep2Body`, `onboardStep3Title`, `onboardStep3Body`, `onboardGotIt`, `onboardSkip`, `onboardBtnTitle` (tooltip for the `?` button).

Hebrew strings use RTL-appropriate phrasing. The modal wrapper gets `dir="rtl"` when `currentLang === 'he'`.

**Hebrew translations:**
- `onboardTitle`: "איך זה עובד"
- `onboardStep1Title`: "יוצרים אירוע"
- `onboardStep1Body`: "נותנים שם, בוחרים תאריכים וטווח שעות, ומשתפים את הקישור."
- `onboardStep2Title`: "מסמנים זמינות"
- `onboardStep2Body`: "לוחצים על תאים בטבלה כדי לסמן מתי אתם פנויים."
- `onboardStep3Title`: "מוצאים את הזמן הטוב ביותר"
- `onboardStep3Body`: "האפליקציה מדרגת את הזמנים לפי כמה אנשים פנויים."
- `onboardGotIt`: "הבנתי ←"
- `onboardSkip`: "דלג"
- `onboardBtnTitle`: "עזרה"

**French translations:**
- `onboardTitle`: "Comment ça marche"
- `onboardStep1Title`: "Créer un événement"
- `onboardStep1Body`: "Nommez-le, choisissez des dates et une plage horaire, puis partagez le lien."
- `onboardStep2Title`: "Indiquer vos disponibilités"
- `onboardStep2Body`: "Cliquez sur les cellules pour montrer quand vous êtes libre."
- `onboardStep3Title`: "Trouver le meilleur créneau"
- `onboardStep3Body`: "L'app classe les créneaux selon le nombre de personnes disponibles."
- `onboardGotIt`: "Compris →"
- `onboardSkip`: "Passer"
- `onboardBtnTitle`: "Aide"

---

## Help Button (`?`)

- Positioned in the existing bottom-left controls bar (`.top-controls` / `#top-controls`), alongside theme and language toggles.
- Same pill/toggle visual style as existing buttons.
- `aria-label` = i18n `onboardBtnTitle`.
- Visible on both screens at all times.
- Clicking it calls `showOnboarding()` without modifying localStorage.

---

## Layout & Styling

**Desktop (>640px):**
- Centered modal, `max-width: 420px`
- `border-radius: var(--r)` (22px) on all corners
- Backdrop: `rgba(8, 28, 19, 0.50)` (matches existing name overlay)
- Fade-in: `opacity 0.3s ease`
- Steps displayed as a vertical list with icon + text side by side

**Mobile (≤640px):**
- Bottom sheet: slides up from bottom edge
- `border-radius: 22px 22px 0 0` (top corners only)
- Full viewport width
- "Got it" button stretches full width
- Slide-up animation: `transform translateY` 0.3s ease

**Step item layout:**
- Icon: 36×36px circle, `background: var(--accent-glow)`, centered emoji
- Heading: `font-family: var(--font-display)`, 15px, 600 weight
- Body: `font-family: var(--font-body)`, 13px, `color: var(--muted)`

---

## Implementation Scope

All changes are confined to `index.html` (single-file app, no build step):

1. **HTML** — add modal markup and `?` button
2. **CSS** — modal, bottom sheet, step items, backdrop, animations
3. **JS** — `showOnboarding()`, `dismissOnboarding()`, localStorage check on load, `?` button wiring
4. **i18n** — add 10 keys to each of the 3 language objects; update `setLang()` to translate modal when language switches while modal is open

---

## Out of Scope

- No multi-step wizard / progress dots (single scrollable panel)
- No images or illustrations beyond emoji icons
- No backend tracking of onboarding completion
