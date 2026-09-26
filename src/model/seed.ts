import type { State } from './types'

/** State for a fresh install: the default presets, no documents, one empty layout. */
export const seedState: State = {
  documents: [],
  presets: [
    { id: 'preset-key-term', name: 'Key term', style: { background: '#fef08a' }, shortcut: '1' },
    { id: 'preset-emphasis', name: 'Emphasis', style: { color: '#b91c1c', bold: true, underline: true }, shortcut: '2' },
  ],
  highlights: [],
  links: [],
  layouts: [{ id: 'layout-default', name: 'Default', windows: [] }],
}
