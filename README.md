# Text Study

A local-first web app for close reading. Enter passages of text, lay them out side by side on a pannable canvas, highlight substrings with a keystroke, and keep everything in one JSON file you own.

Design rules, data model, and architecture live in [CLAUDE.md](CLAUDE.md). This file covers how to run and use the app.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Test and build

```bash
npm test          # run the unit tests once
npm run test:watch
npm run lint
npm run build     # type-check and produce static files in dist/
```

## Using the app

- **Highlight.** Select text inside a window, then press the preset's shortcut key. The legend in the top-left lists presets and their keys. Overlapping highlights are fine.
- **Edit text.** Click **Edit** in a window's header to swap in a textarea. Highlights are adjusted as you type and reappear when you click **Done**.
- **Canvas.** Drag the background to pan, scroll to zoom, drag a window by its header to move it.
- **Export / Import.** The buttons in the top-right download the whole state as a JSON file or replace it from one. State is also saved to the browser's localStorage automatically.

Nothing is sent anywhere. There is no backend.

## Project layout

```
src/
  model/     State types, seed data, and pure State -> State actions
  lib/       Pure algorithms: segment flattening, style merging,
             selection-to-range, range adjustment on edit
  store/     The single Zustand store holding the State object
  storage/   Where the JSON lives: versioned envelope, localStorage
             adapter, debounced persistence, file export/import
  canvas/    React components: canvas, window node, toolbar, legend
```

Business logic goes in `model/` and `lib/` as plain functions with unit tests. Components in `canvas/` stay thin.

## Stack

Vite, React, TypeScript, Tailwind CSS, React Flow (canvas), Zustand (store), Vitest (tests).
