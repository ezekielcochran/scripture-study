# Text Study Tool

A local-first web app for close reading. The user enters passages of text, lays them out side by side on a freely arrangeable canvas, applies preset highlight styles to substrings with a keystroke, and records connections between highlighted spans.

## Non-negotiable design rules

- **Blocks are plain user-entered text.** A block is whatever the user typed or pasted, plus an optional title. No built-in content and no assumed structure. A note is a block of kind `note`. (Older versions called blocks documents.)
- **Text stays editable after it's highlighted.** Highlights are character ranges, so every edit to a block's text must adjust the ranges over it in the same transaction: insertions and deletions shift later ranges, ranges that span an edit grow or shrink, and a range whose text is entirely deleted is removed (along with its links). Text and highlights must never be updated separately.
- **Highlights are data, not markup.** Never write styling into the text. Highlights are ranges plus a preset reference, rendered on top of the plain text at display time. Overlapping highlights are expected and must render correctly.
- **Presets are data.** A preset is a named bundle of visual properties (color, bold, italic, underline, and so on) with an optional keyboard shortcut. Presets are user-created and editable; the app ships with a small default set the user can change or delete.
- **Local-first, no backend.** All state lives in the browser and can be exported to and imported from a single JSON file. Nothing is sent anywhere. Do not add auth, servers, or network calls.
- **The whole app state is one plain JSON object.** Persistence, export, and any future sync are just "where does this JSON live." Storage code must be isolated in one module so it can be swapped without touching the rest of the app.

## Data model

Everything is keyed by generated IDs. Keep this shape stable; extend it only by adding optional fields.

```
State
  workspaces:  Workspace[]
  blocks:      Block[]
  presets:     Preset[]
  highlights:  Highlight[]
  links:       Link[]
  windows:     Window[]
  portals:     Portal[]
  currentWorkspaceId

Workspace  { id, name }                                    // a canvas of its own; the first is named "main"
Block      { id, workspaceId, title?, text, createdAt, kind?: 'note' }   // notes are blocks shown in yellow windows
Preset     { id, workspaceId, name, style: { color?, background?, bold?, italic?, underline? }, shortcut? }
Highlight  { id, blockId, start, end, presetId, note? }     // [start, end) offsets into block.text
Link       { id, from: LinkEnd, to: LinkEnd, label? }
LinkEnd    { kind: 'highlight' | 'block', id }             // a highlight, or a whole block
Window     { id, blockId, range?: { start, end }, x, y, width, height, z }
Portal     { id, pairId, workspaceId, targetWorkspaceId, x, y, z }     // two-sided: both sides share pairId
```

A window shows a whole block or a sub-range of one; a window lives on the workspace of its block, and the same block may appear in many windows. Presets belong to a workspace, and a new workspace starts with copies of the presets of the workspace it was created from. Links connect highlights and/or blocks (never windows), and are drawn on every window that shows an endpoint. Portals are canvas elements that jump to another workspace; creating one also creates its counterpart there, and deleting either side removes both. Storage is versioned (see `src/storage/envelope.ts`); older files migrate on load.

## Architecture

- Single-page app built with React and a modern bundler, deployed as static files to the user's own domain.
- A pannable, zoomable canvas shows one workspace at a time: its windows and portals. Each window is a component rendering block text with highlights. Links between highlights are drawn as labeled edges on the canvas.
- A single app-wide store holds the `State` object. Components read from it and dispatch changes to it; no component owns shared data.
- Storage module: load on startup, save on every change (debounced), plus export/import as a JSON file download/upload.

## Key algorithms (keep these pure and unit-tested)

- **Segment flattening.** Given `text` and the highlights over it, produce an ordered list of non-overlapping segments, each carrying the set of presets that cover it. This is what the renderer consumes. Test with nested, overlapping, adjacent, and zero-length cases.
- **Selection to range.** Map a browser text selection inside a rendered window back to `{ documentId, start, end }` offsets into the original text, regardless of how many styled spans the DOM contains. Test with selections that cross existing highlight boundaries.
- **Style merging.** When multiple presets cover a segment, combine them deterministically. Rule: properties that can combine (bold, italic, underline) all apply; where presets contradict (both set `color`, or both set `background`) the preset earlier in the `presets` list wins, so list order is the priority order.
- **Range adjustment on edit.** Given an edit `{ position, deletedLength, insertedText }` and the ranges over a block (highlights and window sub-ranges), return the adjusted ranges. Test edits before, inside, spanning, and after a range, and edits that delete a range completely.

## Conventions

- Prefer small, pure functions over clever components. Business logic goes in plain modules, not inside React components.
- Keyboard-first for highlighting: select text, press the preset's shortcut, done. Mouse-only flows are acceptable as a fallback but not the primary path.
- Keep the window-management surface minimal: move, resize, bring to front, close. No snapping, tabs, or tiling unless explicitly requested.
- Work in small steps. Each task should leave the app runnable and be committed on its own.
- When introducing a React pattern that isn't obvious from plain JavaScript, add a short comment explaining why it's used.

## Out of scope for now

Multi-user features, sync across devices, accounts, mobile layout, printing/export to other formats.
