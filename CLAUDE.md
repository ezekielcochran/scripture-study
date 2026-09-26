# Text Study Tool

A local-first web app for close reading. The user enters passages of text, lays them out side by side on a freely arrangeable canvas, applies preset highlight styles to substrings with a keystroke, and records connections between highlighted spans.

## Non-negotiable design rules

- **Documents are plain user-entered text.** A document is whatever the user typed or pasted, plus an optional title. No built-in content and no assumed structure.
- **Text stays editable after it's highlighted.** Highlights are character ranges, so every edit to a document's text must adjust the ranges over it in the same transaction: insertions and deletions shift later ranges, ranges that span an edit grow or shrink, and a range whose text is entirely deleted is removed (along with its links). Text and highlights must never be updated separately.
- **Highlights are data, not markup.** Never write styling into the text. Highlights are ranges plus a preset reference, rendered on top of the plain text at display time. Overlapping highlights are expected and must render correctly.
- **Presets are data.** A preset is a named bundle of visual properties (color, bold, italic, underline, and so on) with an optional keyboard shortcut. Presets are user-created and editable; the app ships with a small default set the user can change or delete.
- **Local-first, no backend.** All state lives in the browser and can be exported to and imported from a single JSON file. Nothing is sent anywhere. Do not add auth, servers, or network calls.
- **The whole app state is one plain JSON object.** Persistence, export, and any future sync are just "where does this JSON live." Storage code must be isolated in one module so it can be swapped without touching the rest of the app.

## Data model

Everything is keyed by generated IDs. Keep this shape stable; extend it only by adding optional fields.

```
State
  documents:   Document[]
  presets:     Preset[]
  highlights:  Highlight[]
  links:       Link[]
  layouts:     Layout[]

Document   { id, title?, text, createdAt }
Preset     { id, name, style: { color?, background?, bold?, italic?, underline? }, shortcut? }
Highlight  { id, documentId, start, end, presetId, note? }   // [start, end) offsets into document.text
Link       { id, from: LinkEnd, to: LinkEnd, label? }
LinkEnd    { kind: 'highlight' | 'document', id }        // a highlight, or a whole document
Layout     { id, name, windows: Window[] }
Window     { id, documentId, range?: { start, end }, x, y, width, height, z }
```

A window shows a whole document or a sub-range of one. A layout is a saved arrangement of windows; the same document may appear in many windows and many layouts. Links connect highlights and/or documents (never windows), and are drawn on every window that shows an endpoint.

## Architecture

- Single-page app built with React and a modern bundler, deployed as static files to the user's own domain.
- A pannable, zoomable canvas holds the windows. Each window is a component rendering document text with highlights. Links between highlights are drawn as labeled edges on the canvas.
- A single app-wide store holds the `State` object. Components read from it and dispatch changes to it; no component owns shared data.
- Storage module: load on startup, save on every change (debounced), plus export/import as a JSON file download/upload.

## Key algorithms (keep these pure and unit-tested)

- **Segment flattening.** Given `text` and the highlights over it, produce an ordered list of non-overlapping segments, each carrying the set of presets that cover it. This is what the renderer consumes. Test with nested, overlapping, adjacent, and zero-length cases.
- **Selection to range.** Map a browser text selection inside a rendered window back to `{ documentId, start, end }` offsets into the original text, regardless of how many styled spans the DOM contains. Test with selections that cross existing highlight boundaries.
- **Style merging.** When multiple presets cover a segment, combine them deterministically (define and document the precedence rule).
- **Range adjustment on edit.** Given an edit `{ position, deletedLength, insertedText }` and the ranges over a document (highlights and window sub-ranges), return the adjusted ranges. Test edits before, inside, spanning, and after a range, and edits that delete a range completely.

## Conventions

- Prefer small, pure functions over clever components. Business logic goes in plain modules, not inside React components.
- Keyboard-first for highlighting: select text, press the preset's shortcut, done. Mouse-only flows are acceptable as a fallback but not the primary path.
- Keep the window-management surface minimal: move, resize, bring to front, close. No snapping, tabs, or tiling unless explicitly requested.
- Work in small steps. Each task should leave the app runnable and be committed on its own.
- When introducing a React pattern that isn't obvious from plain JavaScript, add a short comment explaining why it's used.

## Out of scope for now

Multi-user features, sync across devices, accounts, mobile layout, printing/export to other formats.
