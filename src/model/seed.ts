import type { State } from './types'

// Temporary hard-coded state so the first vertical slice has something to render.
// Replaced by persistence in a later step.
export const seedState: State = {
  documents: [
    {
      id: 'doc-1',
      title: 'Sample',
      text: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
      createdAt: '2026-09-26T00:00:00.000Z',
    },
  ],
  presets: [
    {
      id: 'preset-yellow',
      name: 'Key term',
      style: { background: '#fef08a' },
      shortcut: '1',
    },
    {
      id: 'preset-red',
      name: 'Emphasis',
      style: { color: '#b91c1c', bold: true, underline: true },
      shortcut: '2',
    },
  ],
  highlights: [
    // "the Word, and the Word was with God"
    { id: 'hl-1', documentId: 'doc-1', start: 21, end: 56, presetId: 'preset-yellow' },
    // "the Word was with God, and the Word was God" (overlaps hl-1)
    { id: 'hl-2', documentId: 'doc-1', start: 35, end: 78, presetId: 'preset-red' },
  ],
  links: [],
  layouts: [
    {
      id: 'layout-1',
      name: 'Default',
      windows: [
        { id: 'win-1', documentId: 'doc-1', x: 80, y: 80, width: 420, height: 220, z: 1 },
      ],
    },
  ],
}
