# 09. Scatter to layout

The signature Photo Sorter effect. Items lie scattered across a canvas, slightly tilted and gently drifting. On a trigger, each one flies along its own arc into an organized layout (a grid, groups, islands), straightening and resizing as it goes, in a staggered cascade. It can fly back the same way, and it reverses smoothly even mid-flight.

## Use it for

The "aha" moment of a product that organizes things: sorting, scheduling, grouping, matching. A landing-page hero that explains the product without words.

## Instructions for Claude

- **Requires 08 (canvas tiles):** paste `setupCanvas` and `drawTile` from `08-canvas-tiles.md` too.
- Paste the helpers block (safe to paste again).
- Create `new TileStage(canvas, tiles, { layout })`.
  - `tiles`: an array of objects. Each can have `img` (a thumbnail from 08) or `color`.
  - `layout(tiles, stage)`: returns one target `{x, y, size}` per tile, in the same order. It runs every frame, so it follows resizes automatically. Keep it cheap, or cache it and recompute only when the stage size changes.
- `stage.go(1)` flies to the layout, `stage.go(0)` back to the scatter. Both return a promise.
- Draw labels, island outlines or highlights in `stage.afterDraw = (g, time) => { ... }`.
- The loop pauses when the canvas is off screen or the tab is hidden. Call `stage.destroy()` when removing it.
- With reduced motion, tiles jump straight to the target and don't drift.

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
class TileStage {
  constructor(canvas, tiles, { layout, tileSize = 28, drift = 3 } = {}) {
    this.layout = layout;
    this.tileSize = tileSize;
    this.amp = drift;
    this.now = 0;
    this.visible = true;
    this.afterDraw = null;
    // each tile gets a random scatter spot, tilt and drift phase, fixed for its lifetime
    this.tiles = tiles.map(t => ({
      ...t,
      nx: 0.04 + Math.random() * 0.92, ny: 0.07 + Math.random() * 0.86,
      rot: (Math.random() - 0.5) * 0.7, ph: Math.random() * Math.PI * 2,
      u: 0, from: 0, to: 0, start: 0, dur: 1,
    }));
    this.stage = setupCanvas(canvas, () => this.draw(this.now));
    this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; });
    this.io.observe(canvas);
    const loop = ms => {
      this.now = ms / 1000;
      if (this.visible && !document.hidden) this.draw(this.now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  scatterPos(t, time) {
    const { w, h } = this.stage, a = Motion.reduced() ? 0 : this.amp;
    return { x: t.nx * w + Math.sin(time * 0.55 + t.ph) * a, y: t.ny * h + Math.cos(time * 0.47 + t.ph) * a * 0.8 };
  }

  // target 1 = layout, 0 = scatter. stagger(tile, index) returns a start delay in seconds.
  go(target, { duration = 1.0, stagger = (t, i, n) => (i / n) * 0.5 + Math.random() * 0.35 } = {}) {
    const reduced = Motion.reduced(), n = this.tiles.length;
    let last = 0;
    this.tiles.forEach((t, i) => {
      t.from = reduced ? target : t.u;    // start from wherever it is now: smooth mid-flight reversal
      t.to = target;
      if (reduced) t.u = target;          // reduced motion: jump straight to the end state
      const d = reduced ? 0 : stagger(t, i, n);
      t.start = this.now + d;
      t.dur = reduced ? 0.0001 : duration;
      last = Math.max(last, d);
    });
    return Motion.wait(reduced ? 0 : (last + duration) * 1000 + 50);
  }

  draw(time) {
    if (!this.stage) return;
    const { clamp, lerp, easeInOut, bezier } = Motion;
    const g = this.stage.begin();
    const targets = this.layout(this.tiles, this.stage);
    this.tiles.forEach((t, i) => {
      const k = clamp((time - t.start) / t.dur, 0, 1);
      t.u = lerp(t.from, t.to, easeInOut(k));
      const a = this.scatterPos(t, time), b = targets[i], e = t.u;
      // arc: control point above the midpoint, offset per tile so paths don't overlap
      const cx = (a.x + b.x) / 2 + (t.ph - Math.PI) * 8;
      const cy = Math.min(a.y, b.y) - 40 - t.ph * 6;
      const x = bezier(a.x, cx, b.x, e), y = bezier(a.y, cy, b.y, e);
      drawTile(g, x, y, lerp(this.tileSize, b.size, e), { img: t.img || null, fill: t.color, rot: t.rot * (1 - e) });
    });
    if (this.afterDraw) this.afterDraw(g, time);
  }

  destroy() { cancelAnimationFrame(this.raf); this.io.disconnect(); }
}

// Example layout: a centered grid
function gridLayout(cols, gap = 6) {
  return (tiles, { w, h }) => {
    const rows = Math.ceil(tiles.length / cols);
    const size = Math.min(44, (w * 0.9) / cols - gap, (h * 0.85) / rows - gap);
    const x0 = (w - cols * (size + gap)) / 2 + (size + gap) / 2;
    const y0 = (h - rows * (size + gap)) / 2 + (size + gap) / 2;
    return tiles.map((_, i) => ({ x: x0 + (i % cols) * (size + gap), y: y0 + Math.floor(i / cols) * (size + gap), size }));
  };
}
```

```js
// Usage
const tiles = slots.map(s => ({ color: heatColor(s.count) }));
const hero = new TileStage(document.querySelector('#hero'), tiles, { layout: gridLayout(7) });
setTimeout(() => hero.go(1, { stagger: (t, i) => (i % 7) * 0.09 + Math.random() * 0.3 }), 1200); // left columns first
```

## Making it look like islands (the Photo Sorter map)

Use `10-layout-math.md`: give each group a circle sized by its item count, place the circles with `placeOnSpiral`, and place each group's tiles inside its circle with `sunflower`. Then in `afterDraw`, draw each island as a radial gradient in its group color plus a thin ring, and its name above it.

## Tuning

- Stagger by group order (first group lands first) or by column (left to right). Add 0.2 to 0.7 s of randomness.
- About 1.0 s per flight. With many tiles, raise it slightly (up to 1.5 s).
- Animate at most about 1,200 tiles (see `sampleEvenly` in 08).
