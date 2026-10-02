import type { State } from '../model/types'

/**
 * Everything that leaves the app (localStorage, export files, a future backend)
 * is wrapped in this envelope so the shape can be migrated when it changes.
 */
export const CURRENT_VERSION = 3

export interface Envelope {
  app: 'text-study'
  version: number
  savedAt: string // ISO 8601
  state: State
}

export function wrap(state: State, now: Date = new Date()): Envelope {
  return { app: 'text-study', version: CURRENT_VERSION, savedAt: now.toISOString(), state }
}

export function serialize(state: State, now?: Date): string {
  return JSON.stringify(wrap(state, now), null, 2)
}

export type ParseResult = { ok: true; state: State } | { ok: false; error: string }

/** Parse and validate a serialized envelope. Never throws. */
export function deserialize(json: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Not valid JSON' }
  }
  if (!isRecord(raw)) return { ok: false, error: 'Expected a JSON object' }
  if (raw.app !== 'text-study') return { ok: false, error: 'Not a Text Study file' }
  if (typeof raw.version !== 'number') return { ok: false, error: 'Missing version' }
  if (raw.version > CURRENT_VERSION) {
    return { ok: false, error: `File version ${raw.version} is newer than this app supports` }
  }
  const migrated = migrate(raw.version, raw.state)
  const problem = validateState(migrated)
  if (problem) return { ok: false, error: problem }
  return { ok: true, state: migrated as State }
}

/** Upgrade older envelopes step by step to CURRENT_VERSION. Add a case per version bump. */
function migrate(version: number, state: unknown): unknown {
  let s = state
  if (version < 2) s = migrateV1toV2(s)
  if (version < 3) s = migrateV2toV3(s)
  return s
}

/**
 * v2 had a single implicit workspace: { documents, presets, highlights, links, layouts }.
 * v3 names it "main", renames documents to blocks, and adds workspaces, portals,
 * per-workspace presets, flat windows, and currentWorkspaceId.
 */
function migrateV2toV3(state: unknown): unknown {
  if (!isRecord(state)) return state
  const ws = 'ws-main'
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const renameEnd = (e: unknown) =>
    isRecord(e) && e.kind === 'document' ? { ...e, kind: 'block' } : e
  const layouts = arr(state.layouts)
  const windows = layouts.flatMap((l) => (isRecord(l) ? arr(l.windows) : []))
  const renameDocId = (o: unknown) => {
    if (!isRecord(o)) return o
    const { documentId, ...rest } = o
    return { ...rest, blockId: documentId }
  }
  return {
    workspaces: [{ id: ws, name: 'main' }],
    blocks: arr(state.documents).map((d) => (isRecord(d) ? { ...d, workspaceId: ws } : d)),
    presets: arr(state.presets).map((p) => (isRecord(p) ? { ...p, workspaceId: ws } : p)),
    highlights: arr(state.highlights).map(renameDocId),
    links: arr(state.links).map((l) => (isRecord(l) ? { ...l, from: renameEnd(l.from), to: renameEnd(l.to) } : l)),
    windows: windows.map(renameDocId),
    portals: [],
    currentWorkspaceId: ws,
  }
}

/** v1 links were highlight-to-highlight only: { fromHighlightId, toHighlightId }. */
function migrateV1toV2(state: unknown): unknown {
  if (!isRecord(state) || !Array.isArray(state.links)) return state
  const links = state.links.map((l: unknown) => {
    if (!isRecord(l) || !isStr(l.fromHighlightId) || !isStr(l.toHighlightId)) return l
    const { fromHighlightId, toHighlightId, ...rest } = l
    return {
      ...rest,
      from: { kind: 'highlight', id: fromHighlightId },
      to: { kind: 'highlight', id: toHighlightId },
    }
  })
  return { ...state, links }
}

// ---- Validation ---------------------------------------------------------
// Hand-rolled on purpose: the shape is small and stable, and this keeps the
// storage module dependency-free.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const isStr = (v: unknown) => typeof v === 'string'
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isOptStr = (v: unknown) => v === undefined || isStr(v)
const isOptBool = (v: unknown) => v === undefined || typeof v === 'boolean'

function checkAll(items: unknown, name: string, check: (item: unknown) => boolean): string | null {
  if (!Array.isArray(items)) return `${name} must be an array`
  const bad = items.findIndex((it) => !check(it))
  return bad === -1 ? null : `${name}[${bad}] is malformed`
}

const isWorkspace = (w: unknown) => isRecord(w) && isStr(w.id) && isStr(w.name)

const isBlock = (b: unknown) =>
  isRecord(b) &&
  isStr(b.id) &&
  isStr(b.workspaceId) &&
  isOptStr(b.title) &&
  isStr(b.text) &&
  isStr(b.createdAt) &&
  (b.kind === undefined || b.kind === 'note')

const isPreset = (p: unknown) =>
  isRecord(p) &&
  isStr(p.id) &&
  isStr(p.workspaceId) &&
  isStr(p.name) &&
  isOptStr(p.shortcut) &&
  isRecord(p.style) &&
  isOptStr(p.style.color) &&
  isOptStr(p.style.background) &&
  isOptBool(p.style.bold) &&
  isOptBool(p.style.italic) &&
  isOptBool(p.style.underline)

const isHighlight = (h: unknown) =>
  isRecord(h) &&
  isStr(h.id) &&
  isStr(h.blockId) &&
  isNum(h.start) &&
  isNum(h.end) &&
  isStr(h.presetId) &&
  isOptStr(h.note)

const isLinkEnd = (e: unknown) =>
  isRecord(e) && (e.kind === 'highlight' || e.kind === 'block' || e.kind === 'portal') && isStr(e.id)

const isLink = (l: unknown) =>
  isRecord(l) && isStr(l.id) && isLinkEnd(l.from) && isLinkEnd(l.to) && isOptStr(l.label)

const isRange = (r: unknown) => r === undefined || (isRecord(r) && isNum(r.start) && isNum(r.end))

const isWindow = (w: unknown) =>
  isRecord(w) &&
  isStr(w.id) &&
  isStr(w.blockId) &&
  isRange(w.range) &&
  isNum(w.x) &&
  isNum(w.y) &&
  isNum(w.width) &&
  isNum(w.height) &&
  isNum(w.z)

const isPortal = (p: unknown) =>
  isRecord(p) &&
  isStr(p.id) &&
  isStr(p.pairId) &&
  isStr(p.workspaceId) &&
  isStr(p.targetWorkspaceId) &&
  isNum(p.x) &&
  isNum(p.y) &&
  isNum(p.z)

/** Returns a description of the first problem found, or null if `state` is a valid State. */
export function validateState(state: unknown): string | null {
  if (!isRecord(state)) return 'state must be an object'
  if (!Array.isArray(state.workspaces) || state.workspaces.length === 0) return 'workspaces must be a non-empty array'
  if (!isStr(state.currentWorkspaceId)) return 'currentWorkspaceId must be a string'
  return (
    checkAll(state.workspaces, 'workspaces', isWorkspace) ??
    checkAll(state.blocks, 'blocks', isBlock) ??
    checkAll(state.presets, 'presets', isPreset) ??
    checkAll(state.highlights, 'highlights', isHighlight) ??
    checkAll(state.links, 'links', isLink) ??
    checkAll(state.windows, 'windows', isWindow) ??
    checkAll(state.portals, 'portals', isPortal)
  )
}
