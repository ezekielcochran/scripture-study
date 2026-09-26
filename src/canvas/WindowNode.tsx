import { useState, type CSSProperties } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { flattenSegments } from '../lib/segments'
import { styleForPresetIds } from '../lib/style'
import { diffEdit } from '../lib/ranges'
import { closeWindow, editDocument } from '../model/actions'
import type { PresetStyle } from '../model/types'
import { DRAG_HANDLE_CLASS, type WindowNode as WindowNodeType } from '../lib/layout'
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

const textClasses = 'nowheel grow p-3 font-serif text-base leading-relaxed whitespace-pre-wrap'
const headerButton = 'rounded px-1.5 py-0.5 hover:bg-gray-200'

export function WindowNode({ data }: NodeProps<WindowNodeType>) {
  // Selector-style subscription: the node re-renders only when the State object changes.
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  // Edit mode is view state for this window only, so it lives here rather than in the store.
  const [editing, setEditing] = useState(false)

  const win = state.layouts.flatMap((l) => l.windows).find((w) => w.id === data.windowId)
  const doc = win && state.documents.find((d) => d.id === win.documentId)
  if (!win || !doc) return <div className="p-2 text-red-600">Missing window or document</div>

  const range = win.range ?? { start: 0, end: doc.text.length }
  const text = doc.text.slice(range.start, range.end)

  function onTextChange(next: string, caret: number) {
    const edit = diffEdit(text, next, caret)
    if (!edit || !doc) return
    // The textarea shows the window's sub-range, so shift the edit into document offsets.
    update((s) => editDocument(s, doc.id, { ...edit, position: edit.position + range.start }))
  }

  return (
    // `group` lets the resize handles appear only while hovering the window.
    <div className="group flex h-full flex-col overflow-hidden rounded border border-gray-300 bg-white shadow">
      <NodeResizer
        minWidth={200}
        minHeight={120}
        lineClassName="!border-transparent"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-gray-400 !bg-white opacity-0 group-hover:opacity-100"
      />
      <div
        className={`${DRAG_HANDLE_CLASS} flex cursor-move items-center justify-between border-b border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600`}
      >
        <span className="truncate font-medium">{doc.title ?? 'Untitled'}</span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" className={headerButton} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            className={headerButton}
            title="Close window"
            onClick={() => update((s) => closeWindow(s, win.id))}
          >
            ×
          </button>
        </span>
      </div>
      {editing ? (
        <textarea
          className={`${textClasses} w-full resize-none outline-none`}
          value={text}
          onChange={(e) => onTextChange(e.target.value, e.target.selectionStart)}
          autoFocus
        />
      ) : (
        // nowheel: React Flow class name that stops canvas zooming inside this element so it
        // can scroll instead. Only the header drags, so text selection works here.
        <div
          {...{ [WINDOW_TEXT_ATTR]: win.id }}
          className={`${textClasses} cursor-text select-text overflow-auto`}
        >
          {flattenSegments(
            text,
            state.highlights
              .filter((h) => h.documentId === doc.id)
              .map((h) => ({ ...h, start: h.start - range.start, end: h.end - range.start })),
          ).map((seg) => (
            <span key={seg.start} style={toCss(styleForPresetIds(seg.presetIds, state.presets))}>
              {seg.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
