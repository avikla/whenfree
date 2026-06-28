# Onboarding Language Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EN/FR/HE language buttons to the top of the first-time onboarding modal so users can pick their language before reading the help content.

**Architecture:** Single file change to `index.html` — add a `<div class="onboard-lang">` row inside `.onboard-panel`, style it to match the existing `.lang-toggle` top-bar buttons, and wire up the active state in `applyLang()`. Clicking a button calls the existing `setLang(code)` which already updates all `data-i18n` elements and the panel's `dir` attribute.

**Tech Stack:** Vanilla JS, inline CSS, no build step. Firebase Firestore backend (not touched). GitHub Pages deployment.

## Global Constraints

- All changes are inside `index.html` only — no other files modified.
- No new JS functions — reuse existing `setLang(code)` and `applyLang()`.
- CSS must use existing custom properties (`--accent`, `--on-primary`, `--muted2`, `--border2`, `--surface`, `--font-body`).
- `escHtml()` is not needed here — button labels are hardcoded strings, not user input.
- Language codes displayed as `EN`, `FR`, `HE` (short codes, not native labels).

---

### Task 1: Add the lang bar HTML and CSS

**Files:**
- Modify: `index.html` (HTML block ~line 1243; CSS block ~line 1071)

**Interfaces:**
- Produces: `#onboard-lang-en`, `#onboard-lang-fr`, `#onboard-lang-he` button elements that `applyLang()` (Task 2) toggles `active` on.

- [ ] **Step 1: Add the lang bar inside the onboarding panel**

In `index.html`, locate the onboarding panel HTML (~line 1244):

```html
  <div class="onboard-panel">
    <button class="onboard-close" aria-label="Close" onclick="dismissOnboarding(true)">✕</button>
    <h2 class="onboard-title" id="onboard-title" data-i18n="onboardTitle">How it works</h2>
```

Insert the lang bar between the close button and the h2:

```html
  <div class="onboard-panel">
    <button class="onboard-close" aria-label="Close" onclick="dismissOnboarding(true)">✕</button>
    <div class="onboard-lang">
      <button id="onboard-lang-en" onclick="setLang('en')">EN</button>
      <button id="onboard-lang-fr" onclick="setLang('fr')">FR</button>
      <button id="onboard-lang-he" onclick="setLang('he')">HE</button>
    </div>
    <h2 class="onboard-title" id="onboard-title" data-i18n="onboardTitle">How it works</h2>
```

- [ ] **Step 2: Add CSS for `.onboard-lang`**

In `index.html`, locate the `/* Onboarding modal */` CSS comment (~line 1071). Add the following immediately after the `.onboard-help-btn:hover` rule (~line 1147), before the `/* Mobile bottom sheet */` comment:

```css
.onboard-lang{
  display:flex;align-items:center;direction:ltr;
  background:var(--surface);border:1px solid var(--border2);border-radius:20px;
  overflow:hidden;font-family:var(--font-body);font-size:12px;font-weight:500;
  margin-bottom:20px;align-self:flex-start;
}
.onboard-lang button{
  background:none;border:none;cursor:pointer;
  padding:5px 11px;color:var(--muted2);line-height:1;
  transition:color 0.15s,background 0.15s;
}
.onboard-lang button.active{background:var(--accent);color:var(--on-primary);border-radius:20px}
.onboard-lang button:not(.active):hover{color:var(--text)}
```

Note: `direction:ltr` keeps the EN/FR/HE order consistent in RTL mode. `align-self:flex-start` prevents the pill from stretching full-width since `.onboard-panel` uses `flex-direction:column`.

- [ ] **Step 3: Manually verify the lang bar renders**

Open `index.html` in a browser (or run the local dev server). Clear `localStorage` in DevTools (`localStorage.clear()` in the console), then reload. The onboarding modal should appear with:
- A pill-shaped `[EN] [FR] [HE]` row at the top of the panel
- `EN` highlighted in green (active), `FR` and `HE` in muted color
- A gap below the pill before the "How it works" heading

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add language bar HTML and CSS to onboarding modal"
```

---

### Task 2: Wire up active state in applyLang()

**Files:**
- Modify: `index.html` (JS block — `applyLang()` function ~line 1891)

**Interfaces:**
- Consumes: `#onboard-lang-en`, `#onboard-lang-fr`, `#onboard-lang-he` elements from Task 1.
- Consumes: `currentLang` (module-level variable, set by `setLang()`).

- [ ] **Step 1: Add active-class toggling for the onboard lang buttons**

In `index.html`, locate `applyLang()` (~line 1891). Find the block that toggles active on the top-bar and mobile lang buttons:

```js
  document.getElementById('lang-en')?.classList.toggle('active', currentLang === 'en');
  document.getElementById('lang-fr')?.classList.toggle('active', currentLang === 'fr');
  document.getElementById('lang-he')?.classList.toggle('active', currentLang === 'he');
  document.getElementById('mobile-lang-en')?.classList.toggle('active', currentLang === 'en');
  document.getElementById('mobile-lang-fr')?.classList.toggle('active', currentLang === 'fr');
  document.getElementById('mobile-lang-he')?.classList.toggle('active', currentLang === 'he');
```

Add three lines immediately after (before the closing `const op = ...` block):

```js
  document.getElementById('onboard-lang-en')?.classList.toggle('active', currentLang === 'en');
  document.getElementById('onboard-lang-fr')?.classList.toggle('active', currentLang === 'fr');
  document.getElementById('onboard-lang-he')?.classList.toggle('active', currentLang === 'he');
```

- [ ] **Step 2: Manually verify active state and live re-render**

In the browser with `localStorage` cleared, open the onboarding modal:

1. **Active state on load:** `EN` button is highlighted green.
2. **Click FR:** The modal title changes to "Comment ça marche", all step text switches to French, `FR` becomes green, `EN` goes muted.
3. **Click HE:** Text switches to Hebrew, panel flips to RTL (`dir="rtl"`), `HE` becomes green. The lang bar itself stays LTR (buttons remain in EN/FR/HE order).
4. **Click "Compris →" (or Hebrew equivalent):** Modal dismisses. The main page behind is now in the language you chose.
5. **Reload:** Language persists (localStorage `lang` key was set by `setLang`).
6. **Second visit (onboarding already dismissed):** Modal does not appear — returning user flow is unchanged.

- [ ] **Step 3: Verify mobile bottom-sheet layout**

Resize browser to ≤640px (or use DevTools mobile emulation). The onboarding appears as a bottom sheet. Confirm:
- The lang pill wraps cleanly above the heading within the sheet's padding.
- Tapping a language updates the sheet content in place.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: wire active state for onboard lang buttons in applyLang"
```
