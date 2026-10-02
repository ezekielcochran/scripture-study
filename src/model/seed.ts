import type { State } from './types'

export const MAIN_WORKSPACE_ID = 'ws-main'

/** State for a fresh install: one empty workspace called "main" and the default presets. */
export const seedState: State = {
  workspaces: [{ id: MAIN_WORKSPACE_ID, name: 'main' }],
  blocks: [],
  presets: [
    { id: 'preset-highlight', workspaceId: MAIN_WORKSPACE_ID, name: 'Highlight', style: { background: '#f7ef5b' }, shortcut: '1' },
    { id: 'preset-green', workspaceId: MAIN_WORKSPACE_ID, name: 'Green', style: { color: '#4b9f58', italic: true }, shortcut: 'g' },
    { id: 'preset-emphasis', workspaceId: MAIN_WORKSPACE_ID, name: 'Emphasis', style: { color: '#b91c1c', bold: true, underline: true }, shortcut: '2' },
    { id: 'preset-underline', workspaceId: MAIN_WORKSPACE_ID, name: 'Underline', style: { underline: true }, shortcut: 'u' },
  ],
  highlights: [],
  links: [],
  windows: [],
  portals: [],
  currentWorkspaceId: MAIN_WORKSPACE_ID,
}
