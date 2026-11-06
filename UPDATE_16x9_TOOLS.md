# INDEX 00 — 16:9 Canvas + Movable Tool Palette

This version updates the Editorial V2 interface of the actual full-stack app and offline preview.

Changes:
- Canvas and its visible frame are locked to landscape 16:9 at every viewport size.
- The format toggle is intentionally disabled and labeled `format: 16:9`.
- Stage and export preview metadata describe the fixed landscape canvas.
- Earlier project files saved at 9:16 or fluid sizes are reprojected into the 16:9 artboard on restore.
- The tool palette can be dragged by its entire top row (except the Reset button).
- `RESET POSITION` returns the tool palette to its initial position.
- Drag position is persisted with the existing local storage system.
- Fixes CSS specificity that previously prevented the floating palette from moving.
- Shader code, brush tools, patterns, material lab, project storage, and exporters are preserved.

Validation:
- Chromium viewport checks: 1440×900, 1000×750, 390×844.
- Visible canvas aspect 16:9 and border-frame alignment tested.
- Tool panel drag and reset tested on all three sizes.
- Settings and Darkroom retained the 16:9 artboard.
- Export dialog opens and shows `LANDSCAPE / 16:9`.
- No JavaScript page errors observed during these browser interaction tests.
- Full React/npm build not executed (dependencies not installed in this runtime).

How to run:
- Extract ZIP and run RUN_WINDOWS.bat for the full-stack app.
- Or run RUN_OFFLINE_PREVIEW_WINDOWS.bat for the offline preview.
