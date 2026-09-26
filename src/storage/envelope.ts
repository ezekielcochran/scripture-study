import type { State } from '../model/types'

/**
 * Everything that leaves the app (localStorage, export files, a future backend)
 * is wrapped in this envelope so the shape can be migrated when it changes.
 */
export const CURRENT_VERSION = 1

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
  // Version 1 is the first; nothing to migrate yet.
  void version
  return state
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

const isDocument = (d: unknown) =>
  isRecord(d) && isStr(d.id) && isOptStr(d.title) && isStr(d.text) && isStr(d.createdAt)

const isPreset = (p: unknown) =>
  isRecord(p) &&
  isStr(p.id) &&
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
  isStr(h.documentId) &&
  isNum(h.start) &&
  isNum(h.end) &&
  isStr(h.presetId) &&
  isOptStr(h.note)

const isLink = (l: unknown) =>
  isRecord(l) && isStr(l.id) && isStr(l.fromHighlightId) && isStr(l.toHighlightId) && isOptStr(l.label)

const isRange = (r: unknown) => r === undefined || (isRecord(r) && isNum(r.start) && isNum(r.end))

const isWindow = (w: unknown) =>
  isRecord(w) &&
  isStr(w.id) &&
  isStr(w.documentId) &&
  isRange(w.range) &&
  isNum(w.x) &&
  isNum(w.y) &&
  isNum(w.width) &&
  isNum(w.height) &&
  isNum(w.z)

const isLayout = (l: unknown) =>
  isRecord(l) && isStr(l.id) && isStr(l.name) && checkAll(l.windows, 'windows', isWindow) === null

/** Returns a description of the first problem found, or null if `state` is a valid State. */
export function validateState(state: unknown): string | null {
  if (!isRecord(state)) return 'state must be an object'
  return (
    checkAll(state.documents, 'documents', isDocument) ??
    checkAll(state.presets, 'presets', isPreset) ??
    checkAll(state.highlights, 'highlights', isHighlight) ??
    checkAll(state.links, 'links', isLink) ??
    checkAll(state.layouts, 'layouts', isLayout)
  )
}
