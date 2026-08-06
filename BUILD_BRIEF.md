# BUILD_BRIEF.md — PDF Editor (codename: Inkwell)

Standing brief for all future sprints on this repo. Built 2026-08-06 for Tim
(the calendar-app client) via Jess; first build was executed in one session by
Fable in Claude Code.

## Stack & environment

Locked at scaffold time (pin deliberately; don't drift by copy-paste):

- Vite 8.2.1 + React 19.2.8 + TypeScript 5.9.3 (TS 7 existed but was skipped
  for ecosystem safety)
- pdfjs-dist 6.2.108 (rendering/pixels), pdf-lib 1.17.1 (structure/export),
  docx 9.7.1, fflate 0.8.3, nanoid 6.0.1
- Hand-written design-token CSS (`src/styles/tokens.css`), dark pro-tool
  chrome. No Tailwind, no component libraries, no icon libraries.
- Target machine: Windows 11, repo at `E:\git\PDF-editor`. Dev port **5179**
  (5173/5174/5178 are claimed by other local frontends); `PORT` env wins.
- Deployment: Vercel static SPA (`vercel.json` rewrite). No backend, no env
  vars, no accounts. Files never leave the browser.

## The autonomy clause (applies to every sprint)

Work autonomously to completion. Do not stop to ask for confirmation on
reversible implementation choices — pick the sound default, note it in the
sprint report, and keep going. Never: change the locked stack, add paid
services, add a backend, or weaken the redaction guarantee without flagging.

## The Recon → Build → Verify contract

Every sprint runs RECON (read this brief + the touched subsystems before
writing), BUILD, VERIFY (run `npm test`, `npm run build`, and a live browser
pass on the affected flows — do this, don't skip), and reports divergences.

## Sacred invariants (do NOT break these without flagging)

1. **`src/lib` and `src/tools` are framework-free** — no React imports
   (ESLint-enforced). `src/lib/core` must run in plain Node; `src/lib/render`
   is the one documented browser-only exception (pdf.js + canvas).
2. **Overlay rects live in the page's unrotated PDF-point space** (bottom-left
   origin) — the same space pdf-lib draws in. `CoordinateMapper` is the ONLY
   place screen↔PDF conversion happens. Display rotation is applied by
   pdf.js viewports, `rotationCss.ts`, and canvas transforms that all mirror
   the mapper's corner mapping.
3. **No per-tool branching in components.** Canvas tools dispatch through
   `TOOL_REGISTRY` (src/config/tools.ts), overlay rendering through the
   `RENDERERS` table, dialogs through the `DIALOGS` table. Adding a tool means
   adding registry entries, never editing component control flow.
4. **Redaction must be real.** A page carrying a redact overlay is rasterized
   at export with the box fused into pixels; `bakePipeline` THROWS if a redact
   overlay ever reaches the vector path. Erase is cosmetic and the UI must
   keep saying so.
5. **All mutation flows through `dispatch()`** (command + computed inverse) so
   everything is undoable. No direct state pokes.
6. **pdf.js proxies never enter session state**; they live in the module-level
   cache in `pdfjsLoader.ts`. Always hand pdf.js a COPY of source bytes (it
   transfers/detaches the buffer it is given).
7. **Rasterization uses `intent: 'print'`** — display intent stalls in hidden
   tabs (rAF pacing) and doesn't flatten annotations.
8. Semantic colors are reserved: `--danger` for destructive actions and
   redaction only, `--warn` for honest-limitation notices only.

## Locked decisions (do not relitigate)

- Client-only; downloads are the output. If persistence is ever wanted, that
  is a new decision gate, not a drift.
- Command-pattern undo (serializable payloads + inverses), not snapshots.
- Word/Excel conversion is best-effort text extraction with image fallback for
  scan pages — quality on complex layouts is a known, documented limit.
- Signatures are visual (rasterized PNG), not certificate-based.
- Standard-14 Helvetica for text overlays (WinAnsi sanitization); typed
  signatures render through the bundled Dancing Script webfont to PNG.
- Minimal hand-rolled XLSX writer (`xlsxMinimal.ts`) instead of a spreadsheet
  library — inline strings are all we emit.
- Two workers (export, convert). Rasterization/extraction stay on the main
  thread because that's where pdf.js and canvas live; workers do assembly.

## Decision gates

- ⚠️ GATE A — OCR for scanned PDFs (would make convert/redact work on scans):
  needs a wasm OCR engine decision before any sprint promises it.
- ⚠️ GATE B — true text *editing* of existing PDF text (content-stream
  rewrite): research-grade; do not promise without a spike sprint.

## Verification baseline

53 unit/integration tests (`npm test`): CoordinateMapper golden fixtures for
all four rotations, command/inverse round-trips, session behavior, bake
pipeline (reorder/rotate/crop/blank/overlays/subset/raster paths), xlsx
validity, range parsing. Live-browser pass: open → annotate → redact → export
(verified the redacted text is unextractable from the output), Word/Excel/
images conversion, aggressive compress, split, extract.

## Sprint reports

Write to `docs/reports/sprint-N.md`: What shipped / What you need to do once /
What's deferred / Verification.
