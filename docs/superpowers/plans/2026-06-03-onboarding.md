# Onboarding Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-visit onboarding modal that explains how Meteor works to new users (creators and participants), with a persistent `?` help button for returning users.

**Architecture:** All changes are confined to `index.html` (single-file app, no build step). The modal lives at the `<body>` level (like the existing accessibility panel), uses the same backdrop pattern as `.name-overlay`, and integrates with the existing `applyLang()` / `data-i18n` i18n system. A `localStorage` key `meteor_onboarded` gates the auto-show on first visit.

**Tech Stack:** Vanilla JS, CSS custom properties (Verde design system), Firebase/Firestore (not touched), localStorage

---

## File Map

| File | Change |
|------|--------|
| `index.html` | Add modal HTML, CSS, JS, i18n keys, `?` button |

---

### Task 1: Add i18n keys to all three language objects

**Files:**
- Modify: `index.html` — three `LANGS` objects (EN ~line 1184, HE ~line 1247, FR ~line 1311)

- [ ] **Step 1: Add keys to the EN object**

Find this line (EN block):
```
gridHint:'Drag to mark your free times.', bestTimes:'Best times',
legendFewerFree:'Fewer free', legendEveryone:'Everyone',
```
Add after `legendEveryone:'Everyone',`:
```javascript
onboardTitle:'How it works',
onboardStep1Title:'Create an event', onboardStep1Body:'Name it, pick dates and a time range, then share the link.',
onboardStep2Title:'Mark your availability', onboardStep2Body:'Click cells on the grid to show when you\'re free.',
onboardStep3Title:'Find the best time', onboardStep3Body:'The app ranks slots by how many people are available.',
onboardGotIt:'Got it →', onboardSkip:'Skip', onboardBtnTitle:'Help',
```

- [ ] **Step 2: Add keys to the HE object**

Find this line (HE block):
```
gridHint:'גרור כדי לסמן זמינות.', bestTimes:'זמנים מומלצים',
legendFewerFree:'פחות פנויים', legendEveryone:'כולם',
```
Add after `legendEveryone:'כולם',`:
```javascript
onboardTitle:'איך זה עובד',
onboardStep1Title:'יוצרים אירוע', onboardStep1Body:'נותנים שם, בוחרים תאריכים וטווח שעות, ומשתפים את הקישור.',
onboardStep2Title:'מסמנים זמינות', onboardStep2Body:'לוחצים על תאים בטבלה כדי לסמן מתי אתם פנויים.',
onboardStep3Title:'מוצאים את הזמן הטוב ביותר', onboardStep3Body:'האפליקציה מדרגת את הזמנים לפי כמה אנשים פנויים.',
onboardGotIt:'הבנתי ←', onboardSkip:'דלג', onboardBtnTitle:'עזרה',
```

- [ ] **Step 3: Add keys to the FR object**

Find this line (FR block):
```
gridHint:'Cliquez pour indiquer vos disponibilités.', bestTimes:'Meilleurs créneaux',
legendFewerFree:'Moins libres', legendEveryone:'Tous',
```
Add after `legendEveryone:'Tous',`:
```javascript
onboardTitle:'Comment ça marche',
onboardStep1Title:'Créer un événement', onboardStep1Body:'Nommez-le, choisissez des dates et une plage horaire, puis partagez le lien.',
onboardStep2Title:'Indiquer vos disponibilités', onboardStep2Body:'Cliquez sur les cellules pour montrer quand vous êtes libre.',
onboardStep3Title:'Trouver le meilleur créneau', onboardStep3Body:'L\'app classe les créneaux selon le nombre de personnes disponibles.',
onboardGotIt:'Compris →', onboardSkip:'Passer', onboardBtnTitle:'Aide',
```

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat: add onboarding i18n keys (EN/HE/FR)"
```

---

### Task 2: Add modal HTML and `?` button

**Files:**
- Modify: `index.html` — body-level HTML, after the `#top-controls` div (~line 904)

- [ ] **Step 1: Add the onboarding modal markup**

After the closing `</div>` of `#top-controls` (line ~904), insert:

```html
<!-- Onboarding modal -->
<div id="onboard-overlay" class="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
  <div class="onboard-panel">
    <h2 class="onboard-title" id="onboard-title" data-i18n="onboardTitle">How it works</h2>
    <div class="onboard-steps">
      <div class="onboard-step">
        <div class="onboard-icon">📅</div>
        <div class="onboard-text">
          <div class="onboard-step-title" data-i18n="onboardStep1Title">Create an event</div>
          <div class="onboard-step-body" data-i18n="onboardStep1Body">Name it, pick dates and a time range, then share the link.</div>
        </div>
      </div>
      <div class="onboard-step">
        <div class="onboard-icon">✅</div>
        <div class="onboard-text">
          <div class="onboard-step-title" data-i18n="onboardStep2Title">Mark your availability</div>
          <div class="onboard-step-body" data-i18n="onboardStep2Body">Click cells on the grid to show when you're free.</div>
        </div>
      </div>
      <div class="onboard-step">
        <div class="onboard-icon">⭐</div>
        <div class="onboard-text">
          <div class="onboard-step-title" data-i18n="onboardStep3Title">Find the best time</div>
          <div class="onboard-step-body" data-i18n="onboardStep3Body">The app ranks slots by how many people are available.</div>
        </div>
      </div>
    </div>
    <div class="onboard-footer">
      <button id="onboard-got-it" class="onboard-got-it" data-i18n="onboardGotIt">Got it →</button>
      <button id="onboard-skip" class="onboard-skip" data-i18n="onboardSkip">Skip</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add the `?` help button inside `#top-controls`**

Find:
```html
<div class="top-controls" id="top-controls">
```
Add a `?` button as the first child inside that div:
```html
<div class="top-controls" id="top-controls">
  <button id="onboard-help-btn" class="onboard-help-btn" onclick="showOnboarding()" data-i18n-title="onboardBtnTitle" title="Help">?</button>
```

- [ ] **Step 3: Commit**

```
git add index.html
git commit -m "feat: add onboarding modal HTML and help button"
```

---

### Task 3: Add CSS — modal, bottom sheet, steps, animations

**Files:**
- Modify: `index.html` — `<style>` block, before the closing `</style>` tag (~line 825)

- [ ] **Step 1: Add all onboarding CSS**

Paste the following block immediately before `</style>`:

```css
/* Onboarding modal */
.onboard-overlay{
  position:fixed;inset:0;
  background:rgba(8,28,19,0.50);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  z-index:300;
  display:none;align-items:center;justify-content:center;
  opacity:0;transition:opacity 0.3s ease;
}
.onboard-overlay.visible{display:flex;opacity:1}
.onboard-panel{
  background:var(--surface);
  border:1px solid var(--border2);
  border-radius:var(--r);
  padding:36px 32px;
  width:420px;max-width:92vw;
  box-shadow:0 32px 80px rgba(11,32,24,0.12);
}
[data-theme="dark"] .onboard-panel{
  box-shadow:0 32px 80px rgba(200,255,230,0.08);
}
.onboard-title{
  font-family:var(--font-display);
  font-size:22px;font-weight:700;
  color:var(--text);margin:0 0 24px;
}
.onboard-steps{display:flex;flex-direction:column;gap:18px}
.onboard-step{display:flex;align-items:flex-start;gap:14px}
.onboard-icon{
  width:38px;height:38px;flex-shrink:0;
  background:var(--accent-glow);
  border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:18px;
}
.onboard-text{display:flex;flex-direction:column;gap:3px}
.onboard-step-title{
  font-family:var(--font-display);
  font-size:15px;font-weight:600;color:var(--text);
}
.onboard-step-body{
  font-family:var(--font-body);
  font-size:13px;color:var(--muted);line-height:1.55;
}
.onboard-footer{
  display:flex;align-items:center;gap:14px;
  margin-top:28px;
}
.onboard-got-it{
  background:var(--accent);color:var(--on-primary);
  border:none;border-radius:var(--r-pill);
  font-family:var(--font-body);font-size:14px;font-weight:600;
  padding:10px 22px;cursor:pointer;
  transition:opacity 0.15s;
}
.onboard-got-it:hover{opacity:0.9}
.onboard-skip{
  background:none;border:none;cursor:pointer;
  font-family:var(--font-body);font-size:13px;
  color:var(--muted2);padding:0;
  transition:color 0.15s;
}
.onboard-skip:hover{color:var(--muted)}
/* Help button in top-controls */
.onboard-help-btn{
  background:var(--surface);border:1px solid var(--border2);
  border-radius:var(--r-pill);
  font-family:var(--font-body);font-size:13px;font-weight:600;
  color:var(--muted2);
  padding:5px 11px;cursor:pointer;line-height:1;
  transition:color 0.15s,background 0.15s;
}
.onboard-help-btn:hover{color:var(--text)}
/* Mobile bottom sheet (≤640px) */
@media(max-width:640px){
  .onboard-overlay{align-items:flex-end}
  .onboard-panel{
    width:100%;max-width:100%;
    border-radius:22px 22px 0 0;
    padding:28px 20px 32px;
    transform:translateY(40px);
    transition:transform 0.3s ease;
  }
  .onboard-overlay.visible .onboard-panel{transform:translateY(0)}
  .onboard-got-it{flex:1}
}
```

- [ ] **Step 2: Verify the CSS renders correctly**

Open `index.html` in a browser (or check `meet.meteor.co.il` after the next push). Open DevTools console and run:
```javascript
document.getElementById('onboard-overlay').classList.add('visible')
```
Expected: modal appears centered on desktop, slides up from bottom on mobile. "Got it" and "Skip" buttons are visible.

- [ ] **Step 3: Commit**

```
git add index.html
git commit -m "feat: add onboarding modal CSS with mobile bottom sheet"
```

---

### Task 4: Add JS — show/dismiss logic and auto-trigger

**Files:**
- Modify: `index.html` — JS block, near the theme/lang helper functions (~line 1425)

- [ ] **Step 1: Add `showOnboarding` and `dismissOnboarding` functions**

Find `function setLang(code) {` and insert the following two functions directly before it:

```javascript
function showOnboarding() {
  const overlay = document.getElementById('onboard-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  // Force reflow so CSS transition fires
  overlay.offsetHeight;
  overlay.classList.add('visible');
}

function dismissOnboarding(persist) {
  const overlay = document.getElementById('onboard-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  overlay.addEventListener('transitionend', () => { overlay.style.display = 'none'; }, { once: true });
  if (persist) localStorage.setItem('meteor_onboarded', '1');
}
```

- [ ] **Step 2: Wire up the Got it and Skip buttons**

Find the end of the `DOMContentLoaded` block — the last three lines before its closing `});`:
```javascript
  initScreenA();
  applyLang();
  applyTheme();
});
```
Insert the following immediately before the closing `});`:
```javascript
  document.getElementById('onboard-got-it')?.addEventListener('click', () => dismissOnboarding(true));
  document.getElementById('onboard-skip')?.addEventListener('click', () => dismissOnboarding(true));

  // Auto-show for first-time visitors
  if (!localStorage.getItem('meteor_onboarded')) {
    setTimeout(showOnboarding, 600);
  }
```

- [ ] **Step 3: Verify auto-trigger**

Open browser DevTools, run:
```javascript
localStorage.removeItem('meteor_onboarded')
```
Then reload the page. Expected: modal appears after ~600ms.

Click "Got it". Expected: modal closes. Reload again — modal should NOT reappear.

Click `?` button. Expected: modal reopens regardless of localStorage state.

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat: add onboarding show/dismiss JS and auto-trigger"
```

---

### Task 5: Update `applyLang` to re-translate modal when language switches while open

**Files:**
- Modify: `index.html` — `applyLang()` function (~line 1368)

- [ ] **Step 1: Add modal dir update to `applyLang`**

The existing `applyLang()` already handles all `[data-i18n]` elements via `querySelectorAll`, so the modal text will update automatically when `setLang()` is called. The only extra step needed is updating the `dir` attribute on the modal panel so RTL works correctly when Hebrew is active.

Find in `applyLang()`:
```javascript
document.getElementById('lang-en')?.classList.toggle('active', currentLang === 'en');
document.getElementById('lang-fr')?.classList.toggle('active', currentLang === 'fr');
document.getElementById('lang-he')?.classList.toggle('active', currentLang === 'he');
```

Add immediately after:
```javascript
const op = document.querySelector('.onboard-panel');
if (op) op.dir = t().dir;
```

- [ ] **Step 2: Verify language switching**

Open the modal (`?` button). Switch to Hebrew. Expected: all modal text changes to Hebrew, layout flips to RTL. Switch back to EN — text and direction revert.

- [ ] **Step 3: Commit**

```
git add index.html
git commit -m "feat: update onboarding panel dir on language switch"
```

---

### Task 6: Final smoke test and push

- [ ] **Step 1: Full desktop smoke test**

Open `index.html` in a browser:
1. Clear localStorage (`localStorage.clear()`), reload → modal appears after 600ms
2. "Got it" closes it; reload → does NOT reappear
3. `?` button opens modal
4. "Skip" closes it; reload → does NOT reappear
5. Switch to Hebrew while modal is open → text updates, RTL layout applies
6. Switch to French → text updates
7. "Got it" arrow direction is ← in Hebrew, → in EN/FR

- [ ] **Step 2: Mobile smoke test**

Resize browser to ≤640px (or use DevTools device emulation):
1. Modal appears as bottom sheet, slides up from bottom
2. "Got it" button is full width
3. Controls bar `?` button is visible and tappable

- [ ] **Step 3: Push to deploy**

```
git push
```

Expected: `meet.meteor.co.il` updates within ~1 minute via GitHub Pages.
