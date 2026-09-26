import type { State } from './types'

/** State for a fresh install: the default presets, no documents, one empty layout. */
export const seedState: State = {
  documents: [],
  presets: [
    { id: 'preset-highlight', name: 'Highlight', style: { background: '#f7ef5b' }, shortcut: '1' },
    { id: 'preset-green', name: 'Green', style: { color: '#4b9f58', italic: true }, shortcut: 'g' },
    { id: 'preset-emphasis', name: 'Emphasis', style: { color: '#b91c1c', bold: true, underline: true }, shortcut: '2' },
  ],
  highlights: [],
  links: [],
  layouts: [{ id: 'layout-default', name: 'Default', windows: [] }],
}
