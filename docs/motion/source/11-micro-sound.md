# 11. Micro sound

Tiny generated sounds that make motion feel physical: a soft tick for each item landing, rising in pitch as a process advances, and a four-note chime when it finishes. No audio files: everything is synthesized with the Web Audio API.

## Use it for

The end of a sort or upload, items landing during a big animation, a goal reached. **Off by default.** Only play sounds after the user turns them on.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Paste `MicroSound` once. Add a visible "Sound" switch that sets `MicroSound.enabled` and calls `MicroSound.unlock()` **inside the click handler** (browsers only allow audio to start from a user action). Remember the choice in `localStorage`, inside `try/catch`.
- Call `MicroSound.tick(progress)` as items land, with `progress` from 0 to 1. It throttles itself, so calling it for hundreds of items is fine.
- Call `MicroSound.chime()` once at the end.
- Never play sound on page load, and respect a muted switch everywhere.

## Helpers (paste once)

```js
// Motion helpers: safe to paste more than once
window.Motion = window.Motion || (() => {
  // Change this to the app's own "reduce motion" class, if it has one
  const REDUCE_CLASS = 'reduce-motion';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  // Slow start, fast middle, soft landing. The default for almost everything.
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // Overshoots a little, then settles. For things that "pop" into place.
  const easeOutBack = t => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  // Point on a quadratic Bezier curve: start a, control c, end b
  const bezier = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  const reduced = () =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains(REDUCE_CLASS) ||
    (document.body && document.body.classList.contains(REDUCE_CLASS));
  // Calls fn(secondsElapsed) every frame while it returns true. Resolves when done.
  // Pass an AbortSignal to cancel early.
  const frame = (fn, signal) => new Promise(resolve => {
    const t0 = performance.now();
    const loop = now => {
      if (signal && signal.aborted) return resolve(false);
      if (fn((now - t0) / 1000)) requestAnimationFrame(loop); else resolve(true);
    };
    requestAnimationFrame(loop);
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  return { clamp, lerp, easeInOut, easeOutBack, bezier, reduced, frame, wait };
})();
```

## Code

```js
window.MicroSound = window.MicroSound || {
  enabled: false, ctx: null, last: 0,
  // Call from a click handler (for example when the user turns sound on)
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  // A short blip. Pitch rises with progress (0..1). At most one every 28 ms.
  tick(progress = 0) {
    if (!this.enabled) return;
    const now = performance.now(); if (now - this.last < 28) return; this.last = now;
    const a = this.unlock(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.value = 520 + Math.min(1, Math.max(0, progress)) * 820;
    g.gain.setValueAtTime(0.05, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.07);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.08);
  },
  // C major arpeggio: C5 E5 G5 C6
  chime() {
    if (!this.enabled) return;
    const a = this.unlock(); if (!a) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.09;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.55);
    });
  },
};
```

```js
// Usage: the switch
const box = document.querySelector('#sound');
try { box.checked = localStorage.getItem('sound') === '1'; } catch (e) {}
MicroSound.enabled = box.checked;
box.addEventListener('change', () => {
  MicroSound.enabled = box.checked;
  if (box.checked) MicroSound.unlock();
  try { localStorage.setItem('sound', box.checked ? '1' : '0'); } catch (e) {}
});

// Usage: during an animation
items.forEach((it, i) => onLanded(it, () => MicroSound.tick(i / items.length)));
MicroSound.chime();
```

## Tuning

- Keep volume low: gains of 0.04 to 0.08. Sounds should be felt more than heard.
- `triangle` waves sound soft and woody, `sine` pure and bell-like. Avoid `square` and `sawtooth` (harsh).
