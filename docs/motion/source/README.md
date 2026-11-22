# Motion Kit

Visual effects and animation techniques taken from the Practical AI "Photo Sorter" tool, rewritten as small, generic, dependency-free pieces you can drop into any web project one at a time.

Everything here is plain JavaScript and CSS. No libraries, no build step, no framework required. Each file stands on its own: it has its own copy of the shared helpers, so you can import just the effect you want.

## How to use it with Claude in VS Code

1. Copy the files you want into your project, for example into `docs/motion/`.
2. Add this line to the project's `CLAUDE.md`:

   ```
   When adding animation or visual effects, follow the files in docs/motion/source/. Start with docs/motion/source/README.md.
   ```

3. Then ask for an effect by name, for example:

   ```
   Apply docs/motion/05-flip-reorder.md to the Best times cards.
   ```

## The effects

| # | File | What it does | Needs |
|---|------|--------------|-------|
| 01 | `01-render-loop-and-easing.md` | The foundation: time-based animation loop, easing curves, staggering, cancelling | none |
| 02 | `02-breathing-drift.md` | Idle elements drift a few pixels so a static screen feels alive | none |
| 03 | `03-bezier-flight.md` | An element flies from A to B along a curved arc, like a thrown card | none |
| 04 | `04-ripple-stagger.md` | Many items update in a wave spreading from one point | none |
| 05 | `05-flip-reorder.md` | List items slide to their new position after a re-render | none |
| 06 | `06-count-up.md` | Numbers count up and progress bars fill smoothly | none |
| 07 | `07-pulse-and-glow.md` | A ring pulse at a point on screen, and a glow on a card | none |
| 08 | `08-canvas-tiles.md` | Crisp canvas setup, polished image tiles, fast thumbnails | none |
| 09 | `09-scatter-to-layout.md` | Tiles scattered on a canvas fly into an organized layout and back | 08 |
| 10 | `10-layout-math.md` | Sunflower packing, pie slices, non-overlapping spiral placement | none |
| 11 | `11-micro-sound.md` | Tiny Web Audio ticks and a completion chime, off by default | none |

## Good combinations

- **Live data arrived** (someone responded, a record changed): 04 ripple + 06 count-up + 05 reorder.
- **Success moment** (goal reached, all done): 07 pulse + 03 flight into the result + 11 chime.
- **New item joins a list** (new participant, new message): 03 flight into the list + 06 count-up on the counter.
- **Hero or intro animation** that explains the product: 08 + 09, using 10 for the layout.

## Rules for Claude (apply to every file)

- **No libraries.** Use the code in these files. Don't add GSAP, Framer Motion, anime.js or similar unless the user asks.
- **Paste the helpers block as given.** It is written so it is safe to include more than once (it only defines `window.Motion` if it doesn't exist yet).
- **Respect reduced motion. This is required, not optional.** Every effect checks `Motion.reduced()` and jumps straight to the final state. Set `REDUCE_CLASS` in the helpers to the app's own accessibility class if it has one (WhenFree uses `a11y-reduced-motion`).
- **Animation never changes behavior.** The data, the order and the final DOM must be identical with and without animation. Animate the change after the state is updated, never instead of it.
- **Keep it quick.** Most effects should finish in 0.4 to 1.0 seconds. Nothing should block the user from clicking.
- **Animate `transform` and `opacity` only** on DOM elements (plus `background-color` via CSS transitions). Don't animate `width`, `top` or `left` in a loop, except where a file says so.
- **Prefer DOM plus CSS for fewer than about 200 elements.** Switch to canvas (08, 09) only for hundreds of moving items or for full-screen effects.
- **Stop loops when nothing is visible.** Pause on `document.hidden` and when the element is off screen.
- **Test** with Chrome DevTools: Rendering panel, "Emulate CSS prefers-reduced-motion: reduce", and the Performance panel to check for dropped frames.
