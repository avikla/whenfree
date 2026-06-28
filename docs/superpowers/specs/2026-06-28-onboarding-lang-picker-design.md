# Design: Language Picker in Onboarding Modal

**Date:** 2026-06-28
**Status:** Approved

## Problem

First-time visitors have no `lang` in localStorage, so `currentLang` defaults to `'en'`. The onboarding help modal always appears in English, even for users who prefer Hebrew or French.

## Goal

Let the user choose their language before (or while) reading the help modal, so the content is in their language when they read it.

## Approach

Embed a language selector row at the top of the existing `.onboard-panel`. No new overlay, no extra step — the user picks EN / FR / HE and the modal content re-renders instantly in the chosen language.

## Design

### HTML change

Add a `<div class="onboard-lang">` row as the **first child** inside `.onboard-panel`, before the close button and title:

```html
<div class="onboard-lang">
  <button id="onboard-lang-en" onclick="setLang('en')">EN</button>
  <button id="onboard-lang-fr" onclick="setLang('fr')">FR</button>
  <button id="onboard-lang-he" onclick="setLang('he')">HE</button>
</div>
```

Visual layout (desktop):

```
┌────────────────────────────────────────┐
│  [EN]  [FR]  [HE]                 [✕]  │  ← lang bar + close
│ ────────────────────────────────────── │
│  How it works                          │
│  ...4 steps...                         │
│                  [Got it →]            │
└────────────────────────────────────────┘
```

### CSS additions

- `.onboard-lang` — flex row, `gap: 6px`, `margin-bottom: 16px`, `padding-bottom: 16px`, `border-bottom: 1px solid var(--border)`.
- `.onboard-lang button` — pill-shaped, muted color, matching `.lang-toggle button` style from the top-controls.
- `.onboard-lang button.active` — accent color, to show the currently selected language.
- RTL: buttons remain `direction: ltr` (language codes are always displayed LTR).

### JS changes

**`applyLang()`** — add two lines to toggle the `active` class on the new buttons:

```js
document.getElementById('onboard-lang-en')?.classList.toggle('active', currentLang === 'en');
document.getElementById('onboard-lang-fr')?.classList.toggle('active', currentLang === 'fr');
document.getElementById('onboard-lang-he')?.classList.toggle('active', currentLang === 'he');
```

`setLang(code)` already calls `applyLang()`, so clicking a button in the modal:
1. Updates `currentLang` and `localStorage`
2. Re-renders all `data-i18n` elements (including the modal's title, intro, step text, and "Got it" button)
3. Sets `.onboard-panel`'s `dir` attribute for RTL support (already handled in `applyLang`)
4. Highlights the active button in the new lang bar

No other JS changes needed.

## Scope

- Only `index.html` is modified (HTML, CSS, JS are all inline).
- The `meteor_onboarded` / first-time-visitor flow is unchanged.
- Returning users with a saved `lang` see the modal in their language as before; the bar lets them change it if they want.

## Out of scope

- No label text above the buttons (codes are self-explanatory).
- No changes to `help.html`, `terms.html`, or `accessibility-statement.html`.
- No changes to the `mailer.gs` or any GAS files.
