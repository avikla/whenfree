# 10. Layout math

The geometry that makes grouped layouts look calm and even. Groups become circles sized by how many items they hold, the circles are placed without overlapping, and items fill each circle in a sunflower pattern. This is the math behind the Photo Sorter's islands.

## Use it for

Bubble or island maps, grouped galleries, cluster views, tag clouds, any "groups of items" picture. Works for canvas and for absolutely positioned DOM elements.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- These functions only compute positions. They don't draw. Feed the results to 09 (`layout` callback) or set `left` and `top` on DOM elements.
- Order of operations:
  1. Radius per group with `groupRadius(count, tileSize)`.
  2. A box per group: the circle plus room for its title above and labels below.
  3. Place the boxes with `placeOnSpiral(boxes, width, height)`. If it returns `null`, shrink the tile size by 10% and try again (up to about 14 tries), then fall back to rows (`placeInRows`).
  4. Fill each circle with `sunflower(...)`. For subgroups, split the circle into slices with `pieSlices` and fill each slice.
- Recompute on resize, not every frame.

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
// Circle radius that fits `count` tiles of size `tile` (area grows with count, so radius grows with its square root)
function groupRadius(count, tile, { spacing = 1.16, density = 0.74, min = 13 } = {}) {
  return Math.max(min, tile * spacing * Math.sqrt(Math.max(1, count) / (density * Math.PI)) + 3);
}

// n evenly spread points inside a circle (or inside a slice from angle a0 spanning `span`).
// The golden angle / golden ratio means no two points line up, so it never looks like rings or spokes.
function sunflower(n, cx, cy, R, { a0 = 0, span = Math.PI * 2, gap = 0 } = {}) {
  const pts = [], full = span >= Math.PI * 2 - 1e-6;
  for (let i = 0; i < n; i++) {
    const r = R * Math.sqrt((i + 0.5) / n);
    const ang = full ? i * 2.399963 : a0 + gap / 2 + ((i * 0.6180339887) % 1) * Math.max(0.01, span - gap);
    pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
  }
  return pts;
}

// Splits a circle into slices proportional to each subgroup's count, starting at the top.
// groups: [{name, count}] -> [{name, count, a0, span}]
function pieSlices(groups) {
  const total = groups.reduce((s, g) => s + g.count, 0) || 1;
  let a = -Math.PI / 2;
  return groups.map(g => { const span = (g.count / total) * Math.PI * 2, s = { ...g, a0: a, span }; a += span; return s; });
}

// Places boxes {w, h} without overlap, biggest first, walking outward from the center on a spiral.
// Adds x, y (center) and x0, x1, y0, y1 to each box. Returns null if something doesn't fit.
function placeOnSpiral(boxes, W, H, { margin = 12, edge = 6, step = 0.45, turn = 0.21, maxTries = 7000 } = {}) {
  const placed = [], cx = W / 2, cy = H / 2;
  // stretch the spiral to the stage's shape so wide screens fill sideways
  const ax = (W / Math.max(W, H)) * 1.3, ay = (H / Math.max(W, H)) * 1.3;
  for (const b of [...boxes].sort((p, q) => q.w * q.h - p.w * p.h)) {
    let spot = null;
    for (let k = 0; k < maxTries && !spot; k++) {
      const d = k * step, a = k * turn;
      if (d > Math.max(W, H)) break;
      const x = cx + Math.cos(a) * d * ax, y = cy + Math.sin(a) * d * ay;
      const r = { x0: x - b.w / 2, x1: x + b.w / 2, y0: y - b.h / 2, y1: y + b.h / 2 };
      if (r.x0 < edge || r.y0 < edge || r.x1 > W - edge || r.y1 > H - edge) continue;
      if (placed.every(p => r.x1 + margin < p.x0 || r.x0 - margin > p.x1 || r.y1 + margin < p.y0 || r.y0 - margin > p.y1)) spot = { x, y, ...r };
    }
    if (!spot) return null;
    Object.assign(b, spot); placed.push(b);
  }
  return boxes;
}

// Fallback for small screens or many groups: rows of equal cells (the page scrolls instead).
function placeInRows(boxes, W, { cellW = 180, cellH = 180, gap = 12 } = {}) {
  const cols = Math.max(2, Math.floor((W + gap) / (cellW + gap)));
  boxes.forEach((b, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    b.x = gap + c * (cellW + gap) + cellW / 2; b.y = gap + r * (cellH + gap) + cellH / 2;
  });
  return { boxes, height: Math.ceil(boxes.length / cols) * (cellH + gap) + gap };
}
```

```js
// Usage: islands for groups, each split into subfolders
function islandLayout(groups, W, H) {
  let tile = 40, boxes = null;
  for (let tries = 0; tries < 14 && !boxes; tries++, tile *= 0.9) {
    boxes = placeOnSpiral(groups.map(g => {
      const r = groupRadius(g.items.length, tile);
      return { g, r, w: Math.max(2 * r + 12, 120), h: 2 * r + 50 };   // room for the title and labels
    }), W, H);
  }
  if (!boxes) return null;                                             // use placeInRows instead
  for (const b of boxes) {
    b.tile = tile;
    b.points = [];
    for (const s of pieSlices(b.g.subgroups)) {
      b.points.push(...sunflower(s.count, b.x, b.y, b.r - tile * 0.62, { a0: s.a0, span: s.span, gap: 0.12 }));
    }
  }
  return boxes;
}
```

## Notes

- Inset the sunflower radius by about 0.6 of a tile so the outer tiles stay inside the island.
- `step` and `turn` control how finely the spiral searches. Smaller is more precise and slower. The defaults handle about 20 groups instantly.
- Sort groups the same way every time (by size, then name) so the map doesn't shuffle between renders.
