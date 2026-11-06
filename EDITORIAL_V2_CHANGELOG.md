# Index 00 — Editorial UI V2

## What was changed
- New white editorial masthead and compact typographic tool navigation.
- Minimal technical/archival typography, fine borders, rectangular controls.
- Refined left Material Studio inspector, Darkroom, bottom drawing dock, and Export interface.
- Mobile layout for compact screens, retaining horizontally scrollable tool rows.
- Integrated supplied photo into small (~92 px) loading screen: original and CSS-inverted negative alternate every 1.5 seconds.
- Typewriter-style LOADING and true initialization status (00% until ready, then 100%).
- Updated **both** React/Vite full-stack UI and node-only offline preview.
- Corrected offline static server to serve CSS, loader image, and cursor image.

## What was deliberately not changed
- Mesh builder and gesture mathematics
- WebGL shader or GPU renderer
- Raster worker and performance optimizations
- Project save/autosave/restore, image import, undo, modes, controls, export logic

## Run
- `RUN_WINDOWS.bat` — development app (installs dependencies if required)
- `RUN_OFFLINE_PREVIEW_WINDOWS.bat` — standalone preview, no npm install needed
- `npm run preview:offline` — preview on `http://localhost:4173`

## Validation
- Browser DOM/UI smoke-tested at 1440 x 900 and 390 x 844.
- Confirmed no page errors, loader dismissed at initialization, tool/mesh switching, Darkroom and Export opening.
- Confirmed offline preview static CSS and image requests return HTTP 200.
- Shader/brush performance and output fidelity still require testing on hardware-accelerated Chrome/Edge; the headless test browser did not provide usable WebGL.
- Production React build not run because npm dependencies were not cached in this environment.
