# 08. Canvas tiles

The building blocks for drawing hundreds of polished image tiles on a canvas: a canvas that stays sharp on any screen and resizes itself, small square thumbnails made off-screen, and a tile with a white frame, rounded corners and a soft shadow. This is how the Photo Sorter draws its photo map.

## Use it for

Photo walls, file maps, visual overviews with more than about 200 moving items, hero animations. For fewer items, normal DOM elements are simpler and more accessible.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Size the `<canvas>` with CSS (width and height), never with its attributes. `setupCanvas` sets the pixel size from the CSS size and the screen's pixel ratio, and keeps it updated on resize.
- At the start of every frame call `const g = stage.begin()`. It resets the scale and clears.
- Make thumbnails once with `makeThumb` (96 to 224 px), cache them, and draw the cached copy every frame. Never draw the full-size image every frame.
- Draw with `drawTile`. Pass `img` for a photo or `fill` for a colored tile.
- If there are thousands of items, animate a sample (`sampleEvenly(items, 1200)`). The real data is still handled in full.
- A canvas is invisible to screen readers: keep a real list or table of the same data in the page (it can be visually hidden).

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
// Keeps a canvas crisp and sized to its CSS box. onResize(stage) is called after each change.
function setupCanvas(canvas, onResize) {
  const g = canvas.getContext('2d');
  const stage = { canvas, g, w: 0, h: 0, dpr: 1 };
  const fit = () => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (Math.round(r.width) === stage.w && Math.round(r.height) === stage.h && d === stage.dpr) return;
    stage.w = Math.round(r.width); stage.h = Math.round(r.height); stage.dpr = d;
    canvas.width = Math.max(1, Math.round(stage.w * d));
    canvas.height = Math.max(1, Math.round(stage.h * d));
    if (onResize) onResize(stage);
  };
  stage.begin = () => { g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0); g.clearRect(0, 0, stage.w, stage.h); return g; };
  new ResizeObserver(fit).observe(canvas);
  fit();
  return stage;
}

// A square, center-cropped thumbnail from a File, Blob or URL. Cache the result.
async function makeThumb(src, size = 128) {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  const bmp = await createImageBitmap(blob);
  const m = Math.min(bmp.width, bmp.height);
  const c = 'OffscreenCanvas' in window
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, (bmp.width - m) / 2, (bmp.height - m) / 2, m, m, 0, 0, size, size);
  bmp.close();
  return c;
}

// One polished tile centered at (x, y).
function drawTile(g, x, y, size, { img = null, fill = '#e5e7eb', rot = 0, alpha = 1, shadow = size >= 20, border = size >= 22 } = {}) {
  const b = border ? Math.max(1.5, size * 0.06) : 0;   // tiny tiles skip the frame so a wall doesn't look busy
  const r = Math.min(8, size * 0.14);
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y); g.rotate(rot);
  if (shadow) { g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = size * 0.25; g.shadowOffsetY = size * 0.06; }
  g.fillStyle = '#fff';
  g.beginPath(); g.roundRect(-size / 2, -size / 2, size, size, r); g.fill();
  g.shadowColor = 'transparent';
  g.beginPath(); g.roundRect(-size / 2 + b, -size / 2 + b, size - 2 * b, size - 2 * b, Math.max(0, r - b));
  if (img) {
    g.clip();
    const m = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, -size / 2 + b, -size / 2 + b, size - 2 * b, size - 2 * b);
  } else {
    g.fillStyle = fill; g.fill();
  }
  g.restore();
}

// Keeps at most `max` items, evenly spread across the list.
function sampleEvenly(items, max) {
  if (items.length <= max) return items.slice();
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]);
}

// A generated placeholder tile, e.g. for audio or documents (gradient + label)
function labelTile(text, from = '#0EA5A4', to = '#5B00C4', size = 96) {
  const c = 'OffscreenCanvas' in window ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, size, size);
  gr.addColorStop(0, from); gr.addColorStop(1, to);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `bold ${Math.round(size * 0.16)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, size / 2, size / 2);
  return c;
}
```

```js
// Usage
const stage = setupCanvas(document.querySelector('#wall'), () => draw());
const thumbs = await Promise.all(files.slice(0, 300).map(f => makeThumb(f)));
function draw() {
  const g = stage.begin();
  thumbs.forEach((img, i) => drawTile(g, 30 + (i % 20) * 40, 30 + Math.floor(i / 20) * 40, 34, { img }));
}
draw();
```

## Performance notes

- Shadows are the most expensive part. Turn them off for tiles under about 20 px (the default does this).
- Make thumbnails in small batches (for example 8 at a time with `await`) so the page stays responsive.
- `willReadFrequently: true` on `getContext` only if you read pixels back (`getImageData`).
