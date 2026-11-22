# 02. Breathing drift

Idle items drift a few pixels in slow loops, each with its own rhythm. The screen feels alive without anything actually happening. In the Photo Sorter, the scattered photos do this while the folder is being scanned.

## Use it for

Waiting states (loading, scanning, "waiting for responses"), hero backgrounds, decorative tiles or avatars. Not for text people need to read, and not for buttons.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Call `breathe(elements)` on the idle items. Keep the returned `stop` function and call it when the idle state ends.
- It uses the CSS `translate` property, so it doesn't fight with any existing `transform` on the element.
- Keep the amplitude small (2 to 4 px). More than that reads as shaking.
- It pauses itself when the tab is hidden or the items are off screen, and it redraws at about 30 fps to save battery.
- For canvas tiles, use `drift(base, phase, time)` inside your own draw loop instead.

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
// DOM version. Returns a stop() function.
function breathe(elements, { amp = 3, speed = 0.5, fps = 30 } = {}) {
  if (Motion.reduced()) return () => {};
  const items = [...elements].map(el => ({ el, ph: Math.random() * Math.PI * 2 }));
  let stopped = false, visible = true, last = -1;
  const io = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); });
  items.forEach(i => io.observe(i.el));
  Motion.frame(t => {
    if (stopped) return false;
    if (!visible || document.hidden || t - last < 1 / fps) return true;
    last = t;
    for (const i of items) {
      const x = Math.sin(t * speed * 1.1 + i.ph) * amp;
      const y = Math.cos(t * speed * 0.95 + i.ph) * amp * 0.8;
      i.el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    }
    return true;
  });
  return () => { stopped = true; io.disconnect(); items.forEach(i => { i.el.style.translate = ''; }); };
}

// Canvas version: the drifted position of a tile at a given time.
// base = {x, y}, phase = a random number per tile, fixed once.
function drift(base, phase, time, amp = 3) {
  return {
    x: base.x + Math.sin(time * 0.55 + phase) * amp,
    y: base.y + Math.cos(time * 0.47 + phase) * amp * 0.8,
  };
}
```

```js
// Usage
const stop = breathe(document.querySelectorAll('.waiting .avatar'));
// later, when the waiting state ends:
stop();
```

## Tuning

- `amp`: 2 to 4 px. `speed`: 0.3 (calm) to 0.8 (lively).
- Different speeds on x and y (1.1 vs 0.95 above) make the path a slow ellipse instead of a straight line.
- Random phases are what make it organic. Without them everything moves in sync and looks mechanical.
