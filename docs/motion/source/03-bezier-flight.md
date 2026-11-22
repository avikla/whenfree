# 03. Bezier flight

An element flies from one place to another along a curved arc, grows a little in mid-air, and lands softly. In the Photo Sorter every photo flies to its album this way. A straight line looks robotic; an arc looks like something was thrown.

## Use it for

- A new item joining a list (a new participant's avatar flying into the People list).
- Showing where something went (an item flying into a cart, a folder, a "Done" column).
- Connecting cause and effect (a badge flying from a grid cell into the result card).

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Update the real DOM first, then call `flyBetween(source, target)` to animate a **copy** on top. The real element should be hidden (`visibility: hidden`) until the flight resolves, then shown.
- `source` and `target` can be elements or rectangles (`{left, top, width, height}`). If `source` is a rectangle, pass the element to fly as `ghost`.
- Without `ghost`, a copy of the source flies and shrinks or grows to the target's width on the way. With `ghost`, the ghost is sized like the target and flies at that size.
- The flying copy is `position: fixed` on `document.body` and removed when it lands.
- With reduced motion, it resolves at once and nothing flies.

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
// Flies a copy of `source` (or `ghost`) to `target` along an arc. Resolves when it lands.
function flyBetween(source, target, opts = {}) {
  const { clamp, lerp, easeInOut, bezier, frame, reduced } = Motion;
  const { duration = 0.8, lift = 100, wobble = 60, bump = 0.25, ghost = null, matchSize = true } = opts;
  const rect = x => (x instanceof Element ? x.getBoundingClientRect() : x);
  const a = rect(source), b = rect(target);
  if (reduced()) return Promise.resolve();
  const el = ghost || source.cloneNode(true);
  el.removeAttribute && el.removeAttribute('id');
  // A copy of the source keeps the source's size. A ghost takes the target's size.
  const box = ghost ? b : a;
  Object.assign(el.style, {
    position: 'fixed', left: '0', top: '0', margin: '0', boxSizing: 'border-box',
    width: box.width + 'px', height: box.height + 'px',
    pointerEvents: 'none', zIndex: '9999', willChange: 'transform', visibility: 'visible',
  });
  document.body.appendChild(el);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  // The control point sits above the midpoint, a little to the side: that makes the arc
  const cx = (x0 + x1) / 2 + (Math.random() - 0.5) * wobble;
  const cy = Math.min(y0, y1) - lift;
  const endScale = !ghost && matchSize && a.width ? b.width / a.width : 1;
  return frame(t => {
    const u = clamp(t / duration, 0, 1), e = easeInOut(u);
    const x = bezier(x0, cx, x1, e), y = bezier(y0, cy, y1, e);
    const s = lerp(1, endScale, e) * (1 + bump * Math.sin(Math.PI * e)); // grows mid-flight
    el.style.transform = `translate(${x - box.width / 2}px, ${y - box.height / 2}px) scale(${s})`;
    return u < 1;
  }).then(() => el.remove());
}

// Small landing bounce for the real element once the copy arrives
function land(el) {
  if (Motion.reduced()) return;
  el.animate(
    [{ transform: 'scale(.6)' }, { transform: 'scale(1.12)' }, { transform: 'none' }],
    { duration: 380, easing: 'ease-out' }
  );
}
```

```js
// Usage: a new participant flies from the "Join" button into the list
async function addParticipant(person, joinButton) {
  const li = renderParticipant(person);       // your normal render, appended to the list
  li.style.visibility = 'hidden';             // hide the real one until the copy lands
  await flyBetween(joinButton.getBoundingClientRect(), li.querySelector('.avatar'), {
    ghost: makeAvatar(person),                 // a fresh avatar element: this is what flies
  });
  li.style.visibility = '';
  land(li);
}

// Usage: fly a copy of a grid cell's badge into a result card
await flyBetween(cell, resultCard, { lift: 120 });
```

## Tuning

- `lift`: 60 to 140 px. Higher arcs feel more playful.
- `duration`: 0.6 to 0.9 s. Longer distances can take a bit longer.
- Many items flying at once: give each its own start delay (see 01, stagger) so they leave in a cascade.
- `bump` 0 disables the mid-air growth.
