# Sprint 2 — Assisted Edit Text

Built 2026-08-06, same day as Sprint 1, after Jess tested with a 63-page
GaDOE document and asked for text editing.

## What shipped

A new **Edit text** canvas tool (second in the rail): click a line of the
document's own text and it becomes editable — the app hit-tests the click
against the page's extracted text lines, lays a fitted erase cover over the
original, and drops a pre-filled text box at the same position and size with
the cursor ready. Baseline alignment is preserved so the replacement sits
where the original sat.

Supporting engine work: `ADD_OVERLAYS`/`REMOVE_OVERLAYS` commands so the
cover + replacement pair is ONE undo step; `addOverlays()` session wrapper;
per-page extraction cache (source text is immutable, so it's cached for the
session).

## Honest limits (stated in the tool hint and README)

- Replacement text renders in Helvetica — close match, not the original font.
- The covered original remains inside the file (erase semantics); the hint
  points anything sensitive to Redact.
- One line at a time; scanned pages (no text layer) have nothing to click.

## Verification

- 57 tests green (new: ADD_OVERLAYS/REMOVE_OVERLAYS inverse round-trips).
- Live browser: clicked the sample's "Confidential: account…" line → editor
  opened pre-filled with the exact original text; rewrote it; exported;
  confirmed the replacement text is present in the exported PDF's text layer
  and the cover/replacement pair undoes and redoes atomically.

## What's deferred

GATE B narrows but stays open: genuine in-place editing with original-font
fidelity (content-stream rewrite + font subset extension) remains out of
scope without a dedicated spike.
