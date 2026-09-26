import { useLayoutEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { Handle, NodeResizer, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { flattenSegments } from '../lib/segments'
import { presetStyleToCss, styleForPresetIds } from '../lib/style'
import { diffEdit } from '../lib/ranges'
import { closeWindow, documentLabel, editDocument, isNote } from '../model/actions'
import { DRAG_HANDLE_CLASS, documentHandleId, type WindowNode as WindowNodeType } from '../lib/layout'
import { WINDOW_TEXT_ATTR } from './useHighlightShortcuts'
import { clickLinkEnd, isArmed } from './linking'
import { NewDocumentDialog } from './NewDocumentDialog'

const textClasses = 'nowheel grow p-3 font-serif text-base leading-relaxed whitespace-pre-wrap'
const headerButton = 'rounded px-1.5 py-0.5 hover:bg-surface-3'
// Edges attach here. Invisible and not connectable: links are made by clicking highlights.
const handleStyle: CSSProperties = { width: 1, height: 1, minWidth: 0, minHeight: 0, opacity: 0, border: 0, pointerEvents: 'none' }

/** Invisible source and target handles for one highlight, placed at the start of its first span. */
function HighlightHandles({ id }: { id: string }) {
  return (
    <>
      <Handle type="source" position={Position.Left} id={id} isConnectable={false} style={handleStyle} />
      <Handle type="target" position={Position.Left} id={id} isConnectable={false} style={handleStyle} />
    </>
  )
}

export function WindowNode({ id: nodeId, data }: NodeProps<WindowNodeType>) {
  // Selector-style subscription: the node re-renders only when the State object changes.
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  const linkSource = useUiStore((s) => s.linkSource)
  const updateNodeInternals = useUpdateNodeInternals()
  // Edit mode is view state for this window only, so it lives here rather than in the store.
  const [editing, setEditing] = useState(false)
  const [notingAbout, setNotingAbout] = useState(false)

  const win = state.layouts.flatMap((l) => l.windows).find((w) => w.id === data.windowId)
  const doc = win && state.documents.find((d) => d.id === win.documentId)
  const range = win?.range ?? { start: 0, end: doc?.text.length ?? 0 }
  const text = doc ? doc.text.slice(range.start, range.end) : ''
  const highlights = doc
    ? state.highlights
        .filter((h) => h.documentId === doc.id)
        .map((h) => ({ ...h, start: h.start - range.start, end: h.end - range.start }))
    : []
  const segments = flattenSegments(text, highlights)

  // useLayoutEffect: handle positions move whenever the text reflows, so tell React Flow
  // to re-measure them after this render commits and before the edges are painted.
  useLayoutEffect(() => {
    updateNodeInternals(nodeId)
  }, [nodeId, updateNodeInternals, text, state.highlights, win?.width, win?.height, editing])

  if (!win || !doc) return <div className="p-2 text-danger">Missing window or document</div>

  function onTextChange(next: string, caret: number) {
    const edit = diffEdit(text, next, caret)
    if (!edit || !doc) return
    // The textarea shows the window's sub-range, so shift the edit into document offsets.
    // Keystrokes in quick succession form one undo step.
    update((s) => editDocument(s, doc.id, { ...edit, position: edit.position + range.start }), { key: `edit:${doc.id}` })
  }

  /** Click a highlight to start a link, click another end to finish it. */
  function onTextClick(e: MouseEvent<HTMLDivElement>) {
    // A click that ends a drag-selection is not a link click.
    if (!window.getSelection()?.isCollapsed) return
    const span = (e.target as HTMLElement).closest<HTMLElement>('span[data-hl]')
    const ids = span?.dataset.hl?.split(' ').filter(Boolean) ?? []
    if (ids.length === 0) return
    clickLinkEnd({ kind: 'highlight', id: ids[ids.length - 1] }) // innermost highlight wins
  }

  const docEnd = { kind: 'document', id: doc.id } as const
  const docArmed = isArmed(linkSource, docEnd)

  // Which highlights get their handles on which segment: the first segment that contains them.
  const anchored = new Set<string>()

  return (
    // `group` lets the resize handles appear only while hovering the window.
    <div
      className={`group flex h-full flex-col overflow-hidden rounded border border-line shadow ${
        isNote(doc) ? 'bg-note' : 'bg-surface'
      }`}
    >
      <NodeResizer
        minWidth={200}
        minHeight={120}
        lineClassName="border-transparent!"
        handleClassName="h-2.5! w-2.5! rounded-sm! border-line! bg-surface! opacity-0 group-hover:opacity-100"
      />
      <div
        className={`${DRAG_HANDLE_CLASS} relative flex cursor-move items-center justify-between border-b border-line px-2 py-1 text-xs text-muted ${
          isNote(doc) ? 'bg-note-2' : 'bg-surface-2'
        } ${docArmed ? 'outline-2 outline-dashed outline-accent' : ''}`}
      >
        {/* Document-level link ends attach here, at the header's left edge. */}
        <HighlightHandles id={documentHandleId(doc.id)} />
        <span className="truncate font-medium">{documentLabel(doc)}</span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={`${headerButton} ${docArmed ? 'bg-accent-soft' : ''}`}
            title="Link this document: click to start or finish a link"
            onClick={() => clickLinkEnd(docEnd)}
          >
            Link
          </button>
          <button
            type="button"
            className={headerButton}
            title="Create a note linked to this document"
            onClick={() => setNotingAbout(true)}
          >
            Note
          </button>
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
      {notingAbout && (
        <NewDocumentDialog note={{ about: docEnd }} onClose={() => setNotingAbout(false)} />
      )}
      {editing ? (
        <>
          {/* While editing there are no spans to anchor to, so edges point at the window's corner. */}
          <div className="relative h-0 w-0">
            {highlights.filter((h) => h.start < h.end).map((h) => <HighlightHandles key={h.id} id={h.id} />)}
          </div>
          <textarea
            className={`${textClasses} w-full resize-none bg-transparent text-ink outline-none`}
            value={text}
            onChange={(e) => onTextChange(e.target.value, e.target.selectionStart)}
            autoFocus
          />
        </>
      ) : (
        // nowheel: React Flow class name that stops canvas zooming inside this element so it
        // can scroll instead. Only the header drags, so text selection works here.
        <div
          {...{ [WINDOW_TEXT_ATTR]: win.id }}
          className={`${textClasses} cursor-text select-text overflow-auto`}
          onClick={onTextClick}
          onScroll={() => updateNodeInternals(nodeId)}
        >
          {segments.map((seg) => {
            const fresh = seg.highlightIds.filter((h) => !anchored.has(h))
            fresh.forEach((h) => anchored.add(h))
            const isSource = linkSource?.kind === 'highlight' && seg.highlightIds.includes(linkSource.id)
            return (
              <span
                key={seg.start}
                data-hl={seg.highlightIds.join(' ')}
                className={`${fresh.length ? 'relative' : ''} ${isSource ? 'outline-2 outline-dashed outline-accent' : ''} ${seg.highlightIds.length ? 'cursor-pointer' : ''}`}
                style={presetStyleToCss(styleForPresetIds(seg.presetIds, state.presets))}
              >
                {fresh.map((h) => <HighlightHandles key={h} id={h} />)}
                {seg.text}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
