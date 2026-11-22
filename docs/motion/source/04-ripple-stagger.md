# 04. Ripple stagger

When many items change at once, they update in a wave that spreads out from one point, instead of all snapping together. The eye follows the wave and understands where the change came from. Each item can also "pop" as it changes.

## Use it for

- A grid or heatmap that recolors when new data arrives (the wave starts at the cells that changed).
- A list or gallery being filtered.
- Any batch update where you want people to notice the change.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Compute the new state first. Then call `ripple(items, origin, apply)`, where `apply(el)` writes the new state to one element (a class, a `data-` attribute, text).
- Only pass the items that actually changed.
- Put a CSS `transition` on the property that changes (usually `background-color`) so each item also fades smoothly. Use the CSS below.
- `origin` is an element or a point `{x, y}` in viewport coordinates. Use the item the change came from, or the center of the changed area.
- Call `pop(el)` inside `apply` when a value went **up**, so increases stand out.

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

```css
/* Smooth color change for each item */
.cell { transition: background-color .55s cubic-bezier(.65,0,.35,1), border-color .55s cubic-bezier(.65,0,.35,1); }
@media (prefers-reduced-motion: reduce) { .cell { transition: none; } }
```

```js
// Applies apply(el) to each item, delayed by its distance from origin. Resolves when all are done.
function ripple(items, origin, apply, { speed = 1.2, maxDelay = 900 } = {}) {
  const mid = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const o = origin instanceof Element ? mid(origin) : origin;
  const reduced = Motion.reduced();
  let longest = 0;
  for (const el of items) {
    const c = mid(el);
    // speed is pixels per millisecond: 1.2 means the wave crosses 600px in 0.5 s
    const delay = reduced || !o ? 0 : Math.min(maxDelay, Math.hypot(c.x - o.x, c.y - o.y) / speed);
    longest = Math.max(longest, delay);
    if (delay === 0) apply(el); else setTimeout(() => apply(el), delay);
  }
  return Motion.wait(longest + 20);
}

// A quick scale pop. Use when a value increased.
function pop(el) {
  if (Motion.reduced()) return;
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: 500, easing: 'cubic-bezier(.2,.9,.3,1.25)' }
  );
}
```

```js
// Usage: new availability arrived for one participant
async function onResponse(newCounts, originCell) {
  const changed = [];
  for (const cell of grid.querySelectorAll('.cell')) {
    const n = newCounts.get(cell.dataset.key) || 0;
    if (n !== +cell.dataset.count) changed.push(cell);
  }
  await ripple(changed, originCell, cell => {
    const n = newCounts.get(cell.dataset.key) || 0;
    if (n > +cell.dataset.count) pop(cell);
    cell.dataset.count = n;
    cell.dataset.level = levelFor(n);          // your CSS colors by [data-level]
  });
  // run follow-up effects after the wave, e.g. reorder a ranking (05)
}
```

## Tuning

- `speed`: 0.8 (slow, dramatic) to 2 (quick). Keep the whole wave under about 0.8 s.
- For grids whose columns are wider than rows are tall, the wave still looks round because it uses real pixel distance.
- If the change has no natural origin, use the top-left item, or the center of the container.
