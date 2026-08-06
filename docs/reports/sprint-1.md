# Sprint 1 — Inkwell: the whole editor

Built 2026-08-06 in one session, from empty directory to working app.

## What shipped

Everything on Tim's list, client-side only (files never leave the browser):

- **Page operations**: merge (multi-file drop or insert-PDF button), split
  (every N pages or custom ranges → ZIP), delete, insert blank, extract
  (→ new PDF), drag-to-reorder thumbnails, rotate, crop (drag the keep-area;
  applied at export).
- **Sign**: draw / type (Dancing Script) / upload → transparent PNG staged for
  click-to-place, resizable, flattened on export.
- **Markup**: text boxes (inline editing, size/color/bold/align), highlight,
  image placement.
- **Erase vs Redact**, honestly separated: erase = opaque cover (UI warns the
  content is still in the file); redact = the page is re-rendered as a flat
  image at export with the box burned in. Verified: text on a redacted page is
  unextractable from the exported PDF.
- **Compress**: standard (object-stream rebuild) and aggressive (per-page
  re-render at 96/144/200 dpi JPEG).
- **Convert**: Word (.docx, positional text clustering; scans embed as
  images), Excel (.xlsx, gap-based cell recovery, one sheet per page), images
  (PNG/JPEG, ZIP for multi-page).
- Undo/redo across everything; keyboard shortcuts; drag-resize handles; dark
  pro-tool chrome on design tokens.

## What you need to do once

1. **Vercel**: import the GitHub repo → framework preset Vite → deploy.
   No env vars, no config beyond the committed `vercel.json`.

## What's deferred (honest limits, documented in-app and in README)

- OCR for scanned PDFs (GATE A) — scans convert to images, not text.
- Editing text that's already in the PDF (GATE B) — erase-and-retype is the
  workflow; true content-stream editing is research-grade.
- Password-protected PDFs are refused with a clear message.
- Signatures are visual, not certificate-based.

## Code review pass

Two independent reviewers (correctness; conventions/simplicity) audited the
finished build. Conventions: extracted shared `rgbaCss` and `wrapLines`
helpers (three duplicate color converters, two duplicate word-wrappers),
tokenized the redact fill and alpha-derived colors, removed stale matrix
exports. Correctness found one real latent bug, now fixed with tests: source
PDFs whose native `/CropBox` differs from `/MediaBox` (print-style exports)
were modeled in the MediaBox frame while pdf.js renders the CropBox∩MediaBox
frame — overlays and redaction boxes could drift on such files. `PageState`
now carries the effective view box (`baseSize` + `baseOrigin`); the bake
pipeline shifts overlay/crop coordinates into user space.

## Verification

- 55 tests green (`npm test`): CoordinateMapper golden fixtures ×4 rotations,
  command/inverse round-trips, session ops, bake pipeline (reorder, rotation,
  crop, blank pages, overlays, subsets, raster path, redact-guard), xlsx
  validity, page-range parsing.
- `npm run build` clean (tsc strict + Vite 8; workers code-split).
- Live browser pass on the dev server: open 3-page sample → text/highlight/
  redact/rotate/undo → export (242 KB, page 1 flattened, account number
  unextractable) → Word/Excel/images/compress/split/extract all produced
  valid downloads with zero console errors.

## Divergences from the approved blueprint

- **Rasterization runs on the main thread**, not in the workers: that's where
  pdf.js and canvas live. Workers do assembly (pdf-lib bake, docx/xlsx build).
  Three planned workers became two (compress folded into export — compression
  IS a bake). Wall-clock behavior is the same; progress UI covers both stages.
- **Rotation is baked via `/Rotate` + `setRotation`** rather than
  embed-page-with-transform: simpler, preserves source annotations, and keeps
  overlay coordinates identity-mapped. Rendering, DOM, canvas, and export all
  mirror the same corner mapping (tested).
- **Crop displays as a dimmed mask** rather than re-viewporting mid-edit;
  the real CropBox is applied at export.
- `exceljs`/`jszip`/`comlink`/`fontkit` were dropped for lighter equivalents
  (hand-rolled xlsx over fflate; typed signatures via canvas+webfont).
- Found during verification: pdf.js display-intent rendering stalls in hidden
  tabs (rAF pacing) — rasterization uses `intent: 'print'` (sacred invariant
  #7 now).
