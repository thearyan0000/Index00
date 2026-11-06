> **GitHub deployment:** See [GITHUB_DEPLOY.md](GITHUB_DEPLOY.md) for the one-time setup and publish instructions.


# INDEX 00 — Full-stack Material Studio

**This is the actual Index 00 editor, not a placeholder UI.** It preserves the latest
Ghost + Square default, lighting/shadows, reactive white cursor, dark/light modes,
import/transform, mesh brush, Darkroom (Cyanotype, Solarized, Faded Archive,
Oil Canvas), texture controls, camera, and existing export pipeline.

## Start (Windows, macOS, Linux)
Install Node.js 20.19+ / 22.12+ and use an up-to-date Chrome or Edge. On Windows, you can also double-click `RUN_WINDOWS.bat` after extracting the ZIP. The launcher now detects and repairs a previously interrupted `npm install`, including a partially installed `frontend/node_modules` directory.

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
npm run dev
```

Open **http://localhost:5173**. API health: **http://localhost:3001/api/health**.
To create production assets: `npm run build`, then `npm start` to serve frontend
and API together on `http://localhost:3001`.

### Restore the studio defaults

Open **More** and choose **reset studio to defaults** at the top of the sidebar.
After confirmation, this clears the current image, stitches, mesh edits, mask and
undo history, and restores the canvas, material, lighting, blending, brushes,
darkroom, theme and tool positions. Saved projects remain in the library; the
reset workspace starts a new untitled autosave. Cancel keeps your current work.

### Offline working preview (no npm installation required)

```bash
npm run preview:offline
```

Open **http://localhost:4173** (or use `RUN_OFFLINE_PREVIEW_WINDOWS.bat`). This is a WebGL standalone compatibility build
of the editor, not the React+DExie project manager. It is included so you can
run and inspect the artwork even without package installation.

## Performance upgrade — 1.1.0

This release changes **runtime execution**, not just the folder layout. The original
v1 full-stack migration preserved a slow, single-threaded height-map rasterizer.
Repeated symmetry brushes (Doily 6, Radial 12, Mandala) could force a nearly
full-canvas `Path2D` redraw and a synchronous `getImageData()` pixel readback on
every pointer movement. The architectural migration alone could not solve that.

The new renderer adds:

1. **OffscreenCanvas raster worker:** expensive mesh, lace and thread rasterization
   runs in a dedicated browser Worker instead of blocking UI/pointer events. The
   worker returns transferred `ImageBitmap` patches for WebGL texture updates.
2. **Damage rectangles instead of one global rectangle:** six mirrored brush
   marks update localized areas instead of a bounding box covering the whole
   artwork. Overlapping patches are merged and very large workloads are promoted
   to a full render.
3. **Spatial geometry search:** dirty renders only enumerate potentially visible
   mesh cells and edges. Re-indexed positions after strokes prevent the brush
   search from degenerating as the mesh is deformed over time.
4. **No height-map `getImageData()` on brush moves:** the synchronous fallback
   uploads clipped canvas regions directly; the Worker uses ImageBitmaps.
5. **One brush input sample per animation frame**, preserving continuous
   interpolation and flushing the final segment on pointer release.
6. **No forced full-viewport repaint half a second after every gesture.**
7. **Synchronous fallback** when OffscreenCanvas or Workers are unavailable.

The app still uses **WebGL**, not WebGPU. The GPU shader, interface, Ghost palette,
Square Mesh default, dark mode, white light-aware symbol cursor, image transforms,
and darkroom effects are retained. No SQLite was added.

### Performance diagnostics

In Chrome or Edge developer tools (F12 → Console), run:

```js
console.table(window.__index00Performance)
```

`workerAvailable` shows whether asynchronous rasterization is active;
`workerLastMs` is time spent preparing the latest raster image **on the worker**,
not the UI thread. `lastBrushMs` measures a recent stroke application;
`lastPatchCount` indicates how many areas were damaged. The number of worker
jobs is lower than pointer events by design, because jobs are coalesced.

For the most responsive experience, use current Chrome or Edge with **hardware
acceleration enabled** and a graphics driver that supports WebGL.

**Limitations:** Worker rasterization makes the interface more responsive; it
cannot guarantee 60 FPS artwork updates for very dense 12- or 24-way patterns,
particularly on CPU-bound systems. The GPU shader itself can also be expensive.
The test environment has no hardware WebGL, so actual GPU FPS on your Windows
machine has not been verified. Browser storage, undo and project restoration are
preserved, but performance should be checked with representative artwork.

## Canvas formats and cloth embroidery

The editor opens in a standard 16:9 workspace. Use the format menu for
4:3, 1:1, 3:4, 9:16 or 21:9. The maximize-canvas and “frame it” controls have
been removed. The tool palette can still be dragged out of the way, and
format changes preserve artwork.

Under **More → Geometry & stitch**, **remove mesh** hides the geometric net
without deleting embroidery. **Restore mesh** brings it back.

Click **cloth & wrinkles** in the toolbar to open the material controls directly.
Choose natural linen, cotton canvas, indigo denim, ivory silk satin, wine velvet,
or tulle net. Each has its own yarn structure, surface relief and light response;
an imported photograph is treated as a print on the selected cloth. These are
procedural materials, not photographs of fabric. **Yarn / weave size** controls
texture scale; mipmaps reduce aliasing when fine yarns become smaller than pixels.

**Wrinkles & drape** offers soft drape, crumpled cloth and pressed creases, with
controls for depth, fold frequency and direction. **Flatten wrinkles** sets depth
to zero. Folds bend the weave and photograph and affect the lighting.

Choose the embroidery tool and adjust **Stitch tension / gathering** for subtle
needle depressions and directional puckering. **Fabric wear / split yarns** is
separate and defaults to 0; increasing it introduces occasional grain-aligned
splits and a few loose fibres. Both sliders affect existing embroidery.
Undo, unpick and unpick all repair the associated damage. This is a procedural
surface deformation and transparency effect, not a dynamic cloth physics solver.
The source photograph is unchanged. Formats, mesh visibility, cloth choice,
tension, wear, wrinkles and blend settings are stored in project checkpoints.

**Surface & colour → Blend mode** now contains all 27 standard modes, from Normal
and Dissolve through Hue, Saturation, Color and Luminosity. They composite the
mesh/embroidery over the cloth or image. **Thread opacity** controls coverage and
the density of Dissolve. Older custom blend modes migrate to their closest
standard equivalent. See [material research and implementation](MATERIAL_RESEARCH.md)
for references and the distinctions between the materials.

Dense drawings now use incremental spatial indexes for decorative marks, delta
messages for new stitches, transferred geometry buffers, and mesh indexing only
when geometry changes. Autosave cancels pending serialization when a new gesture
starts. These changes reduce work as a drawing grows; device FPS still needs
measurement on the target browser.

After source changes, regenerate the standalone preview with `npm run build:preview`.
It shares the React editor's templates, styles and engine. Run `npm test` for
spatial-index regression checks, and `npm run build` for the production app.
The standalone preview updates only after regeneration; `npm run dev` runs the
current frontend source directly.

## Architecture

- `frontend/src/app/` — React composition and engine boot
- `frontend/src/components/` — editor shell components (legacy DOM controls retained)
- `frontend/src/templates/` — original UI markup split into stage/header/panels/tools/dialogs
- `frontend/src/styles/` — original styles plus independent project library
- `frontend/src/shaders/` — original GLSL vertex/fragment shader files, imported through Vite
- `frontend/src/engine/` — original tested WebGL renderer/mesh/brush + typed project bridge
- `frontend/src/store/` — Zustand for React app and project library state
- `frontend/src/database/` — Dexie.js / IndexedDB for local project persistence
- `frontend/src/features/projects/` — project library and portable JSON backup
- `backend/src/` — minimal Express API and optional production site host
- `preview/` — dependency-free, runnable copy of the editor for compatibility

### Important technical details

**Rendering:** This migration keeps the original **WebGL GLSL engine**, not a
WGSL/WebGPU rewrite. WebGPU conversion requires rewriting and validating the
shaders and texture pipelines. React does not make existing shaders faster by itself.
WebGL remains GPU-accelerated; browser/device GPU performance varies.

**Transitions:** The existing editor controls are mounted in React from small
HTML templates and bound once by `legacyEngine.ts`. This is deliberate so existing
brush, shader and export features survive migration. The engine is still one large
file and should be progressively split into `MeshEngine`, `BrushEngine`, etc.
when parity tests are available. It's **not a complete ground-up rewrite**.

**Autosave:** Browser project state is saved via Dexie when editing stops. Imported
photographs are kept as Blob data. Project backups exported as `.index00.json`
include the image as a data URL, so backups may be large. The editor automatically
recovers the `autosave` slot at launch. Clearing site data can delete IndexedDB,
so also export portable backups.

**Backend:** No database, login, or external image uploads. Express only returns
health/version info and hosts the production bundle. Processing remains local
on the user's GPU. SQLite is not used.

**Performance:** The worker offloads height-map rasterization and the main renderer
keeps dirty-frame drawing, capped device pixel ratio, GPU texture reuse, resize
preservation, and throttled particles. High-resolution export may still hit device
limits; lower export quality if needed.

### Known limitations

- Source React build requires internet to install npm dependencies on a new computer.
- The legacy DOM engine is initialized once per page load, so use full reload for
  hot modifications of graphics internals during development.
- The project manager autosaves common UI inputs and pointer release but does not
  preserve live camera streams or temporary framed-photo inputs; reopening a project does not recover them.
- Undo history is live-session only; stored project snapshots restore the artwork.
- This does not guarantee zero lag or eliminate GPU driver/browser limitations.

## Testing

Open the page and verify: Ghost + Square selection; dark/light toggle; mesh drawing;
image import and transform; 9:16; darkroom sliders; save/export; project save,
reload and restoration. Use current Chrome or Edge with hardware acceleration.

## Fix in Windows-launcher v1.0.1 (npm ETARGET)

The earlier ZIP referenced the nonexistent `dexie-react-hooks@^2.0.0` release, which produced `npm ERR! code ETARGET` during first installation. This release uses the verified published `dexie-react-hooks@^4.4.0` alongside `dexie@^4.4.0`. The Windows launcher now checks for the actual `dexie-react-hooks` package instead of simply checking whether the `frontend/node_modules` folder exists, so it can automatically retry an interrupted install.

To update an existing extracted folder without replacing it: edit `frontend/package.json` to use these two versions, then run `npm --prefix frontend install` from the project root. For the simplest experience, extract this updated ZIP to a new folder and double-click `RUN_WINDOWS.bat`.

## Editorial V2 visual redesign

The editor UI now uses a white editorial masthead, narrow two-level action navigation,
monospaced archival indices, hairline boundaries, a compact material inspector,
a refined studio tools palette, and simplified material-process/export panels.
The actual WebGL rendering pipeline, shaders, raster worker, mesh/editing algorithms,
photography, undo, and existing save/export functionality were left intact.
Dark mode remains available from the toolbar.

The startup screen shows the supplied image at ~92px wide, toggling between original
and negative every 1.5s. Its white background and typewriter-style label are deliberate.
The percentage shows 00% until engine initialisation completes, then 100% — it is
not a fabricated gradual progress indicator.

Both the full-stack React app and offline standalone preview have been updated.
