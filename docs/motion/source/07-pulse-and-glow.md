# 07. Pulse and glow

A glowing ring expands from a point on the screen and fades, and a card briefly glows. In the Photo Sorter a ring sweeps out from the center at the moment the tool "decides" where every photo goes. Use it to mark the one moment that matters.

## Use it for

A goal reached ("everyone is free at this time"), a save or send that succeeded, drawing the eye to where a result appeared. Use it sparingly: once per meaningful event, not on every click.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Paste the `FxLayer` code once. It adds one transparent full-screen canvas that doesn't block clicks, and all pulses share one animation loop that stops when nothing is playing.
- The script must run after `<body>` exists (end of body, or after `DOMContentLoaded`).
- Call `pulseAt(element)` or `pulseAt({x, y})` with viewport coordinates.
- For a card, call `glow(card)`. It uses `box-shadow`, so the card needs no extra markup.
- Use the app's accent color.

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
// One shared overlay canvas for screen effects. Safe to paste more than once.
window.FxLayer = window.FxLayer || (() => {
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '9998' });
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  const fit = () => { const d = devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); };
  addEventListener('resize', fit); fit();
  const effects = new Set();
  let running = false;
  const run = () => {
    if (running) return; running = true;
    const loop = now => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const fx of [...effects]) if (!fx(now / 1000, g)) effects.delete(fx);
      if (effects.size) requestAnimationFrame(loop);
      else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    };
    requestAnimationFrame(loop);
  };
  // fx(seconds, ctx) draws one frame and returns true while it is still running
  return { g, add(fx) { effects.add(fx); run(); } };
})();

// Expanding glowing rings at a point. Resolves when finished.
function pulseAt(target, { color = '#00C281', radius = 150, rings = 2, duration = 0.9, gap = 0.18, lineWidth = 3 } = {}) {
  if (Motion.reduced()) return Promise.resolve();
  const { clamp, easeInOut } = Motion;
  const p = target instanceof Element
    ? (r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }))(target.getBoundingClientRect())
    : target;
  let t0 = null;
  return new Promise(resolve => FxLayer.add((now, g) => {
    if (t0 === null) t0 = now;
    const t = now - t0;
    for (let i = 0; i < rings; i++) {
      const u = clamp((t - i * gap) / duration, 0, 1);
      if (u <= 0 || u >= 1) continue;
      g.save();
      g.globalAlpha = 0.7 * (1 - u);
      g.strokeStyle = color; g.lineWidth = lineWidth;
      g.shadowColor = color; g.shadowBlur = 14;
      g.beginPath(); g.arc(p.x, p.y, 8 + radius * easeInOut(u), 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    const alive = t < duration + gap * (rings - 1);
    if (!alive) resolve();
    return alive;
  }));
}

// A soft glow that spreads out from a card's edges and fades.
function glow(el, color = 'rgba(0,194,129,.55)') {
  if (Motion.reduced()) return;
  const clear = color.replace(/[\d.]+\)$/, '0)');
  el.animate(
    [{ boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 0 18px ${clear}` }],
    { duration: 1200, easing: 'ease-out' }
  );
}
```

```js
// Usage: the "everyone is free" moment
await pulseAt(cell);
glow(bestCard);

// Usage: a big "deciding" sweep from the middle of the screen
pulseAt({ x: innerWidth / 2, y: innerHeight / 2 }, { radius: Math.hypot(innerWidth, innerHeight) * 0.6, rings: 1, duration: 1, color: '#7D63FE' });
```

## Tuning

- `radius` 100 to 180 for a cell or button, screen-sized for a global "something happened".
- `rings` 1 for subtle, 2 for a celebration. More than 3 looks like an alarm.
- Pair with 03 (a chip flying from the pulse into the result) and 11 (a short chime) for the full success moment.
