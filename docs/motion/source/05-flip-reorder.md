# 05. FLIP reorder

When a list is re-rendered in a new order, each item slides from where it was to where it is now, and new items fade and scale in. FLIP stands for First, Last, Invert, Play: measure positions before, re-render, then animate each item from its old position back to its new one.

## Use it for

Rankings that change (best times, leaderboards, top results), sorted tables, kanban columns, any list rebuilt with `innerHTML`.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Every item in the container needs a stable `data-key` that stays the same across renders (an id, not the index).
- Wrap the existing render call: `flip(container, () => render())`. The render function itself does not change.
- It works whether the render rebuilds the elements or moves existing ones.
- Only direct children of the container are animated.
- Removed items just disappear. If they need to fade out, see the note at the end.

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
// Measures children, runs mutate(), then animates each child from its old spot to its new one.
async function flip(container, mutate, { duration = 650, keyAttr = 'key' } = {}) {
  const key = el => el.dataset[keyAttr];
  const before = new Map([...container.children].map(el => [key(el), el.getBoundingClientRect()]));
  await mutate();
  if (Motion.reduced()) return;
  for (const el of container.children) {
    const was = before.get(key(el)), now = el.getBoundingClientRect();
    if (was) {
      const dx = was.left - now.left, dy = was.top - now.top;
      if (dx || dy) el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration, easing: 'cubic-bezier(.65,0,.35,1)' }
      );
    } else {
      el.animate(
        [{ opacity: 0, transform: 'translateY(14px) scale(.94)' }, { opacity: 1, transform: 'none' }],
        { duration: duration * 0.8, easing: 'cubic-bezier(.2,.9,.3,1.2)' }
      );
    }
  }
}
```

```js
// Usage
function renderBestTimes(slots) {
  cards.innerHTML = slots.map(s => `<div class="card" data-key="${s.id}">...</div>`).join('');
}
flip(cards, () => renderBestTimes(newSlots));
```

## Notes

- Combine with 06 (count-up) inside the same render: keep the old numbers in a map keyed by `data-key` and count from them.
- If the element has its own `transform` in CSS, wrap its content in an inner element and keep the transform there, so the animation doesn't override it.
- Fading out removed items: before `mutate()`, clone each item whose key won't survive, place the clone `position: fixed` at its old rect on `document.body`, animate its opacity to 0, then remove it.
