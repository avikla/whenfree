# 01. Render loop and easing

The foundation every other effect builds on. Animations are a function of **time**, not of frame count, so they run at the same speed on a 60 Hz laptop and a 120 Hz phone, and they can be cancelled cleanly.

## Use it for

Any custom animation that CSS transitions can't express: motion along a curve, many items with different start times, canvas drawing, numbers that count.

## Instructions for Claude

- Paste the helpers block once, in the app's main script, before any effect code. It is safe to paste again.
- Set `REDUCE_CLASS` to the app's own reduced-motion class if there is one.
- For a one-off animation, use `Motion.frame(fn)`. `fn` gets the seconds elapsed since start and returns `true` to keep going.
- For one value moving from A to B, compute `u = clamp(t / duration, 0, 1)`, then `e = easeInOut(u)`, then `lerp(a, b, e)`.
- To stagger many items, give each its own start time and compute `u` per item from `(t - start) / duration`.
- Always handle `Motion.reduced()`: set the final state and return.

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

## Patterns

```js
// Usage: move one element 200px to the right in 0.6 s
async function slideRight(el) {
  const { clamp, lerp, easeInOut, frame, reduced } = Motion;
  if (reduced()) { el.style.translate = '200px 0'; return; }
  await frame(t => {
    const u = clamp(t / 0.6, 0, 1);
    el.style.translate = `${lerp(0, 200, easeInOut(u))}px 0`;
    return u < 1;
  });
}

// Usage: stagger. Each item starts a bit after the previous one (a cascade)
async function cascadeIn(items) {
  const { clamp, easeOutBack, frame, reduced } = Motion;
  if (reduced()) { items.forEach(el => { el.style.opacity = 1; el.style.scale = 1; }); return; }
  const DUR = 0.45, STEP = 0.05;
  await frame(t => {
    items.forEach((el, i) => {
      const u = clamp((t - i * STEP) / DUR, 0, 1);
      el.style.opacity = u;
      el.style.scale = 0.8 + 0.2 * easeOutBack(u);
    });
    return t < (items.length - 1) * STEP + DUR;
  });
}

// Usage: cancel a running animation when a new one starts
let ctrl = null;
function restart(el) {
  if (ctrl) ctrl.abort();
  ctrl = new AbortController();
  const { clamp, easeInOut, frame } = Motion;
  frame(t => { const u = clamp(t / 0.5, 0, 1); el.style.opacity = easeInOut(u); return u < 1; }, ctrl.signal);
}
```

## Which easing to use

| Feel | Curve | Use for |
|------|-------|---------|
| Natural movement | `easeInOut` | Anything travelling from A to B |
| Pop, playful | `easeOutBack` | Items appearing, a button confirming |
| CSS equivalent of `easeInOut` | `cubic-bezier(.65,0,.35,1)` | CSS transitions and the Web Animations API |
| CSS equivalent of a gentle pop | `cubic-bezier(.2,.9,.3,1.25)` | CSS keyframes that overshoot |

## Tuning

- Durations: 0.3 s for small UI feedback, 0.6 to 0.9 s for things travelling across the screen, up to 1.5 s for a hero sequence.
- Stagger step: 30 to 60 ms per item. Cap the total so the last item starts within about 0.7 s.
- A little randomness in start times (0 to 0.3 s) makes a group look organic instead of mechanical.
