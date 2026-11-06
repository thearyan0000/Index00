# INDEX 00 — Performance fix verification

## Whole-studio reset — 1 November 2026

The sidebar now includes **reset studio to defaults**, with confirmation before
clearing the current artwork. `node scripts/browser-smoke.mjs --react --reset`
verified cancellation, restored controls and theme, cleared image/stitches/mask,
empty undo history, restored tool position, a clean untitled autosave, and
preservation of a separately saved project. A camera request completed after
reset was discarded and its tracks stopped.

Production build, frontend/backend type checks and all five unit tests passed.
The offline preview was regenerated from the same engine and templates.

## Material and blending update — 1 November 2026

The standard workspace replaces the maximize toggle; “frame it” is removed.
The new toolbar shortcut opens cloth and wrinkle controls directly.

Verified with the real WebGL shader in Chrome headless / SwiftShader:

- All 27 blend functions match either independent Canvas2D compositing or known
  arithmetic reference values (maximum allowed error: 2/255 per channel).
- Six material renders differ, and flat/draped/crumpled/creased states produce
  distinct image output. Fabric screenshots are in `test-results/fabric-*.png`.
- Stable blend IDs, opacity, wrinkle depth/style/direction and weave size survive
  a project checkpoint round trip. An imported photograph and embroidery remain
  present across format changes and restoration.
- Separate tension and wear controls, actual puncture transparency, unpick-all
  repair, 24-fold embroidery and PNG export work without page or shader errors.
- The 390 × 844 layout keeps separate toolbar rows and the correct canvas ratio.

Five unit tests cover blend migration, reproducible production-resolution fabric
maps, open tulle coverage, and spatial indexes for dense embroidery.

Run `node scripts/browser-smoke.mjs --react --materials` for the extended checks.
See [MATERIAL_RESEARCH.md](MATERIAL_RESEARCH.md) for references, implementation
choices and the limits of the procedural material/height-field approach.
These checks do not establish hardware GPU frame rates.

## Current verification — 31 October 2026

The canvas/cloth update has now passed:

- Production build (`npm.cmd run build`) and frontend/backend type checking.
- Three spatial-index regression tests, including a 64,000-mark design.
- Offline preview regeneration from the current React engine and templates.
- Real WebGL shader compilation and rendering in Chrome headless with SwiftShader.
- 16:9 default at 1424 × 801 in a 1440 × 900 viewport; square and portrait switching.
- Mesh hiding/restoring, cloth embroidery, undo, clear and focus mode.
- React checkpoint restoration, imported image preservation and ratio changes.
- A 24-fold embroidery pattern with no page, shader or raster-worker errors.
- Pixel readback assertions: stitches create transparent punctures, and unpick all
  returns the canvas to opaque coverage.
- Worker-disabled fallback rendering and a 390 × 844 layout with separate toolbar
  rows and the correct canvas ratio.

Screenshots and run diagnostics are in `test-results/`. Reproduce browser checks
on Windows with Chrome installed at its standard Program Files location:

```sh
node scripts/browser-smoke.mjs
node scripts/browser-smoke.mjs --react
node scripts/browser-smoke.mjs --fallback
```

These are functional checks with software graphics, not a hardware FPS benchmark.
The historical report below describes an earlier environment and is retained for
context; its build limitation no longer applies to this local installation.

## Change summary

The previous full-stack migration reorganized the app but did not speed up its
legacy CPU mesh rasterizer. This release adds a dedicated OffscreenCanvas worker,
spatial geometry indexing, separate dirty regions, a canvas/bitmap patch upload
path, event coalescing, and current-position brush hit-testing.

## Tests completed in Chromium

A headless Chromium test harness exercised the preserved editor with a **stub
WebGL API** because hardware WebGL cannot be initialized in this environment.
The 2D canvas and worker rasterization actually ran, but shader output and GPU
frame rate are NOT tested by this approach.

Successful checks:
- Editor startup with Ghost / Square defaults
- Light and dark mode
- Format / 9:16 resizing
- Switch Square / Diamond mesh
- Doily 6, Radial 12, and Mandala brush gestures
- OffscreenCanvas worker receives image jobs and returns results without page errors
- Disable Worker -> synchronous fallback still renders local height-map patches
- Darkroom opening and closing
- Image import and photo transformation availability
- Project checkpoint and restore
- Original height-map `getImageData()` calls replaced with canvas / bitmap uploads
- JS and TypeScript engine source parsing / syntax checks

### Indicative CPU-only measurements

At approximately 1560×920 viewport (canvas roughly 1200×700), the original
renderer executed height-map rasterization on the UI thread. In repeated brush
strokes, the original Doily 6 test measured roughly 100–140 ms per synchronous
height-map draw, with 15 pixel readbacks during 15 pointer steps.

The worker build had **zero height-map readbacks on the UI thread** and kept
all follow-up raster draws in a separate worker. Doily worker jobs took roughly
35–55 ms at completion in this software-only environment, while the brush
input work on the main thread was typically below ~1 ms per dispatched
stroke sample. Dense Radial 12 worker jobs could still take 120–160 ms in
software rasterization, so final artwork refresh can lag behind fast pointer
motions even though the cursor and interface remain responsive.

These are development diagnostics, NOT direct or controlled GPU FPS benchmarks;
results vary with the browser, brush path, artwork complexity and machine.

## Build limitation

`npm` package-registry access is unavailable in the packaging environment
(EAI_AGAIN). React, Vite and Express source code was retained, but a fresh npm
install / full React production build cannot be validated here. Install the
project's dependencies on your PC using `RUN_WINDOWS.bat` and run `npm run build`
to verify your local production build. The bundled offline preview was parsed
and browser-tested independently.
