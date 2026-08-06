# PDF Editor

**Everything happens in your browser — your files never leave your computer.**

Open a PDF (or several) and do the things you'd normally need Acrobat for:

- **Organize** — merge PDFs, split into parts, reorder pages by dragging thumbnails, rotate, delete, insert blank pages or another PDF, extract pages, crop.
- **Sign** — draw, type, or upload your signature and place it on the page.
- **Mark up** — add text boxes, highlight, place images.
- **Erase & redact** — cover content cosmetically, or *truly remove* it (see below).
- **Compress** — rebuild the file smaller, or go aggressive for the smallest possible size.
- **Convert** — to Word (.docx), Excel (.xlsx), or images (PNG/JPEG).

Drop several PDFs on the start screen to combine them in order. Undo/redo works for everything (Ctrl+Z / Ctrl+Y).

## Honest answers to fair questions

**Is my file uploaded anywhere?** No. There is no server. The PDF is opened, edited, and rebuilt entirely inside your browser tab, and the result is downloaded straight to your computer.

**What's the difference between Erase and Redact?** Erase paints an opaque box over content — quick for tidying, but the content is still inside the file underneath. Redact actually destroys the content: on export, any page with a redaction is re-rendered as a flat image with the box burned in, so the text underneath is gone and unrecoverable. The trade-off is that a redacted page is no longer selectable text. For anything sensitive, use Redact.

**How good is the Word/Excel conversion?** It's a best-effort reconstruction from the text inside the PDF. Simple documents convert well; complex layouts, multi-column pages, and decorative formatting will lose fidelity. Scanned pages (no text layer) are embedded as images in Word and flagged in Excel. Excel conversion works best on pages that actually contain tables.

**Is the signature a legal digital signature?** It's a visual signature flattened into the page — the same as printing, signing, and scanning. It is not a certificate-based cryptographic signature.

**Password-protected PDFs?** Not supported — remove the password first.

## Running it

```bash
npm install
npm run dev        # local dev server on port 5179
npm run build      # production build to dist/
npm test           # unit + integration tests (document engine, export pipeline)
```

## Deploying to Vercel

The app is a static single-page build — no environment variables, no server functions.

1. Import the GitHub repo in Vercel.
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (Vercel detects both automatically).
3. Deploy. `vercel.json` in the repo handles the SPA rewrite and asset caching.

## Architecture (for developers)

- `src/lib/core/` — framework-free document engine: virtual page list + typed overlay model, command-pattern undo/redo with computed inverses, and a matrix-based `CoordinateMapper` that is the only place screen↔PDF coordinate conversion happens. Unit-tested in plain Node.
- `src/lib/render/` — the pdf.js seam (browser-only): rendering, rasterization with overlay fusion, positional text extraction.
- `src/lib/export/` — the bake pipeline (runs in a Web Worker): page ops + overlays → new PDF via pdf-lib. Redacted pages are replaced by pre-rendered images; the pipeline refuses to vector-bake a redaction.
- `src/tools/` + `src/config/tools.ts` — canvas tools as behavior modules dispatched by table lookup; adding a tool never touches component control flow.
- `src/workers/` — export and convert workers with a typed message protocol.

Stack: Vite 8, React 19, TypeScript 5.9, pdfjs-dist 6, pdf-lib 1.17, docx 9, fflate. Hand-written design-token CSS — no component libraries.
