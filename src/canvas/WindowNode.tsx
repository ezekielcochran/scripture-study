import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { flattenSegments } from '../lib/segments'
import { styleForPresetIds } from '../lib/style'
import type { PresetStyle } from '../model/types'
import type { WindowNode as WindowNodeType } from '../lib/layout'
import { WINDOW_TEXT_ATTR } from './useHighlightShortcuts'

function toCss(s: PresetStyle): CSSProperties {
  return {
    color: s.color,
    backgroundColor: s.background,
    fontWeight: s.bold ? 'bold' : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: s.underline ? 'underline' : undefined,
  }
}

export function WindowNode({ data }: NodeProps<WindowNodeType>) {
  // Selector-style subscription: the node re-renders only when the State object changes.
  const state = useStore((s) => s.state)

  const win = state.layouts.flatMap((l) => l.windows).find((w) => w.id === data.windowId)
  const doc = win && state.documents.find((d) => d.id === win.documentId)
  if (!win || !doc) return <div className="p-2 text-red-600">Missing window or document</div>

  const range = win.range ?? { start: 0, end: doc.text.length }
  const text = doc.text.slice(range.start, range.end)
  // Highlights are stored against the full document, so shift them into the window's range.
  const highlights = state.highlights
    .filter((h) => h.documentId === doc.id)
    .map((h) => ({ ...h, start: h.start - range.start, end: h.end - range.start }))
  const segments = flattenSegments(text, highlights)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded border border-gray-300 bg-white shadow">
      <div className="border-b border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
        {doc.title ?? 'Untitled'}
      </div>
      {/* nodrag/nowheel: React Flow class names that stop node dragging and canvas zooming
          inside this element, so the mouse can select text and scroll it instead. */}
      <div
        {...{ [WINDOW_TEXT_ATTR]: win.id }}
        className="nodrag nowheel cursor-text select-text overflow-auto p-3 font-serif text-base leading-relaxed whitespace-pre-wrap"
      >
        {segments.map((seg) => (
          <span key={seg.start} style={toCss(styleForPresetIds(seg.presetIds, state.presets))}>
            {seg.text}
          </span>
        ))}
      </div>
    </div>
  )
}
