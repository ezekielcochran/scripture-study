# Text Study

A local-first web app for close reading. Enter passages of text as blocks, lay them out side by side on a pannable canvas, highlight substrings with a keystroke, link things together, and keep everything in one JSON file you own. Nothing is sent anywhere. Hosted on [ezekielcochran.com/study](https://people.cs.vt.edu/ecochran/study).

## Use

- **Highlight.** Select text inside a window, then press the preset's key or tap the preset in the legend. Pressing the same preset on a highlighted selection removes it. Overlapping highlights combine; where two presets contradict, the one higher in the preset list wins.
- **Link.** Click a highlight or a window's **Link** button, then click another. Click the line between windows to label it. Clicking the same two things again removes the link.
- **Notes.** **Note** in a window header, or **New note** in the toolbar, creates a yellow note block. With a highlight or block armed, the note is linked to it.
- **Edit text.** Click **Edit** in a window's header. Highlights follow the text as you type. **Done** or Esc leaves edit mode.
- **Workspaces.** Each workspace is its own canvas. **New portal** adds a doorway to another workspace, or to a new one; click a portal to travel through it. The selector at the bottom-left jumps anywhere.
- **Canvas.** Drag the background to pan, scroll or pinch to zoom, drag a window by its header to move it. ⌘Z / Ctrl+Z undoes, with Shift to redo.
- **Export / Import.** Download the whole state as a JSON file or replace it from one. State is also saved in your browser automatically.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).
