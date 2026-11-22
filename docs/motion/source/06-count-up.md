# 06. Count-up numbers and growing bars

Numbers roll smoothly to their new value instead of jumping, and progress bars fill with the same easing. People notice the change and its size at a glance.

## Use it for

Counters (participants, items sorted, totals), scores, "2 of 3 people", percentages, progress bars in cards.

## Instructions for Claude

- Paste the helpers block (safe to paste again).
- Call `countUp(el, newValue)`. It remembers the last shown value on the element, so later calls continue from there. If the element was re-rendered, pass `{ from: oldValue }`.
- Use `format` for thousands separators, decimals or percentages. Use the app's locale (`toLocaleString('he-IL')` for Hebrew UIs).
- A new call on the same element cancels the previous one, so rapid updates never fight.
- For bars, put the CSS transition on `width` and call `growBar(bar, pct, oldPct)`.
- Screen readers: if the number lives in an `aria-live` region, update it with the final value only (set `aria-label` to the final value and the animated text inside `aria-hidden="true"`).

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
.bar > i { display: block; height: 100%; transition: width .8s cubic-bezier(.65,0,.35,1); }
@media (prefers-reduced-motion: reduce) { .bar > i { transition: none; } }
```

```js
// Animates the number in el to `to`. Returns a promise.
function countUp(el, to, { from, ms = 700, format = n => Math.round(n).toLocaleString() } = {}) {
  const { clamp, lerp, easeInOut, frame, reduced } = Motion;
  const start = from ?? el._countNow ?? (parseFloat(el.dataset.countValue) || 0);
  el.dataset.countValue = to;
  const token = (el._countToken = {});
  if (reduced() || start === to) { el._countNow = to; el.textContent = format(to); return Promise.resolve(); }
  return frame(t => {
    if (el._countToken !== token) return false;          // a newer call took over
    const u = clamp((t * 1000) / ms, 0, 1);
    el._countNow = lerp(start, to, easeInOut(u));
    el.textContent = format(el._countNow);
    return u < 1;
  });
}

// Fills a bar to toPct. If the bar was just created, pass its old value as fromPct.
function growBar(bar, toPct, fromPct) {
  if (fromPct != null) {
    const tr = bar.style.transition;
    bar.style.transition = 'none';
    bar.style.width = fromPct + '%';
    void bar.offsetWidth;                                  // apply the start width now
    bar.style.transition = tr;
  }
  requestAnimationFrame(() => { bar.style.width = toPct + '%'; });
}
```

```js
// Usage
countUp(document.querySelector('#people-count'), people.length);
countUp(card.querySelector('.num'), 5, { from: 2 });
countUp(totalEl, 1234.5, { format: n => n.toLocaleString('he-IL', { maximumFractionDigits: 1 }) });
growBar(card.querySelector('.bar > i'), 83, 50);
```

## Tuning

- 400 ms for small counters, 700 ms for headline numbers, up to 1200 ms for a big total at the end of a process.
- For very large jumps (0 to 50,000), the same 700 ms still works: easing keeps it readable.
