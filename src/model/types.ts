// The whole app state is one plain JSON object. Keep this shape stable;
// extend it only by adding optional fields.

export interface Document {
  id: string
  title?: string
  text: string
  createdAt: string // ISO 8601
}

export interface PresetStyle {
  color?: string
  background?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export interface Preset {
  id: string
  name: string
  style: PresetStyle
  shortcut?: string
}

/** A highlight covers the half-open range [start, end) of document.text. */
export interface Highlight {
  id: string
  documentId: string
  start: number
  end: number
  presetId: string
  note?: string
}

/** One end of a link: a specific highlight, or a whole document. */
export type LinkEnd = { kind: 'highlight'; id: string } | { kind: 'document'; id: string }

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

export interface Window {
  id: string
  documentId: string
  range?: Range
  x: number
  y: number
  width: number
  height: number
  z: number
}

export interface Layout {
  id: string
  name: string
  windows: Window[]
}

export interface State {
  documents: Document[]
  presets: Preset[]
  highlights: Highlight[]
  links: Link[]
  layouts: Layout[]
}
