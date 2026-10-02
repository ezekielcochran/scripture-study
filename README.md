# Text Study

A local-first web app for close reading. Enter passages of text as blocks, lay them out side by side on a pannable canvas, highlight substrings with a keystroke, and keep everything in one JSON file you own. Nothing is sent anywhere. Hosted on [ezekielcochran.com/study](https://people.cs.vt.edu/ecochran/study).

## Use

- **Highlight.** Select text inside a window, then press the preset's shortcut key. The legend in the top-left lists presets and their keys. Overlapping highlights are fine.
- **Edit text.** Click **Edit** in a window's header. Highlights are adjusted as you type and reappear when you click **Done**.
- **Canvas.** Drag the background to pan, scroll to zoom, drag a window by its header to move it.
- **Export / Import.** The buttons in the top-right download the whole state as a JSON file or replace it from one. State is also saved in your browser automatically.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).
