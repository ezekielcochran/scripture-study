// The whole app state is one plain JSON object. Keep this shape stable;
// extend it only by adding optional fields.

/** A canvas of its own: blocks, notes, windows, links, and portals to other workspaces. */
export interface Workspace {
  id: string
  name: string
}

/** User-entered text (called a document in older versions). */
export interface Block {
  id: string
  workspaceId: string
  title?: string
  text: string
  createdAt: string // ISO 8601
  /** Notes are blocks shown in translucent yellow windows; absent means a regular block. */
  kind?: 'note'
}

export interface PresetStyle {
  color?: string
  background?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/** Presets belong to a workspace; a new workspace starts with copies of its parent's presets. */
export interface Preset {
  id: string
  workspaceId: string
  name: string
  style: PresetStyle
  shortcut?: string
}

/** A highlight covers the half-open range [start, end) of block.text. */
export interface Highlight {
  id: string
  blockId: string
  start: number
  end: number
  presetId: string
  note?: string
}

/** One end of a link: a specific highlight, a whole block, or a portal (one side of a pair). */
export type LinkEnd = { kind: 'highlight'; id: string } | { kind: 'block'; id: string } | { kind: 'portal'; id: string }

export interface Link {
  id: string
  from: LinkEnd
  to: LinkEnd
  label?: string
}

export interface Range {
  start: number
  end: number
}

/** A view of a block (or a sub-range of it) on its workspace's canvas. */
export interface Window {
  id: string
  blockId: string
  range?: Range
  x: number
  y: number
  width: number
  height: number
  z: number
}

/**
 * A doorway to another workspace. Portals are two-sided: creating one creates
 * its counterpart in the target workspace, and both share a pairId.
 */
export interface Portal {
  id: string
  pairId: string
  workspaceId: string
  targetWorkspaceId: string
  x: number
  y: number
  z: number
}

export interface State {
  workspaces: Workspace[]
  blocks: Block[]
  presets: Preset[]
  highlights: Highlight[]
  links: Link[]
  windows: Window[]
  portals: Portal[]
  currentWorkspaceId: string
}
