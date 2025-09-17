# Kairoscope – Linear Time Visualization

Kairoscope renders the passage of time as a contemplative stream. A golden marker
anchors the present at the center of the viewport while past and future tick
marks drift from right to left. The zoomable canvas lets you inspect temporal
scales ranging from milliseconds to years without losing the sense of flow.

## Experience highlights

- **Precision with calm:** Smooth easing keeps transitions gentle while major
  ticks land on predictable cadences so users never lose context.
- **Multi-scale clarity:** Ticks and labels adapt to the zoom level, collapsing
  detail when space grows tight and expanding it when focus returns.
- **Accessible minimalism:** High-contrast gold-on-black styling, keyboard
  shortcuts, and touch gestures all lead to the same anchored present moment.

## Run locally

1. Install [Node.js 18](https://nodejs.org/) or newer to access the built-in
   test runner and a modern toolchain.
2. Clone the repository and open it in your editor of choice.
3. Launch a lightweight static server (for example, `npx serve .`) or open
   `index.html` directly in a modern browser. The experience is fully
   client-side.

## Controls and interactions

| Input           | Action                                                                       |
|-----------------|------------------------------------------------------------------------------|
| Zoom slider     | Drag to move between millisecond and multi-year views.                       |
| Mouse / touch   | Drag to scrub through time, pinch to zoom, double-click/tap to return home.  |
| Keyboard        | Arrow keys nudge the stream; <kbd>0</kbd> or <kbd>Esc</kbd> resets focus.     |
| Time zone toggle| Switch between local time and UTC.                                           |

A floating status panel always reflects the active scale, focus point, and time
zone. When the viewport drifts away from the present, the banner describes the
offset using natural language (for example, “Exploring +3 hours”).

## Code structure

- `index.html` defines the single-page layout, keeps the present marker centered,
  and exposes ARIA descriptions for screen readers.
- `styles.css` applies the contemplative gold-on-black palette, responsive
  spacing, and cursor state transitions that reinforce dragging.
- `script.js` orchestrates canvas rendering, input handling (mouse, keyboard,
  touch), and status updates. Logic is heavily commented so future contributors
  understand how to validate behaviour with the targeted tests.
- `timeline-core.js` hosts pure utilities for scaling, formatting, and
  timezone-aware labelling. The file embeds guidance on which test covers each
  function and why the guard is necessary.

## Targeted test suite

Kairoscope ships with a focused regression suite that exercises the
math-and-formatting helpers without depending on the DOM. This keeps maintenance
fast and approachable while still catching regressions in the behaviours that
make the visualization trustworthy.

### Run the tests

```bash
npm test
```

The command is defined in `package.json` and delegates to `node --test`, which
executes every scenario in `tests/timeline-core.test.js`.

### What the tests cover

- **Slider scaling:** verifies `msPerPixelFromSlider` keeps logarithmic zoom
  aligned with base-10 powers.
- **Tick cadence:** keeps major and minor ticks within the desired ~120px
  spacing rhythm.
- **Label formatting:** checks that tick labels, duration strings, and focus
  descriptions adapt from millisecond to year scales.
- **Timezone awareness:** ensures UTC toggling and timezone labels remain
  consistent across environments.

Each test includes commentary about the behaviours it protects so newcomers can
confidently expand coverage when they add new helpers.

## Contribution checklist

1. Update or add tests alongside behavioural changes. Mirror the existing
   comment style so intent stays obvious.
2. Run `npm test` and confirm all scenarios pass.
3. Verify the visualization in a browser at multiple zoom levels to maintain
   the smooth, contemplative pacing described in the PRD.

Enjoy exploring the flow of time!
