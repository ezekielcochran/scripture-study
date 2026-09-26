import { useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { deleteLink, setLinkLabel } from '../model/actions'
import type { LinkEdge as LinkEdgeType } from '../lib/layout'

/** A straight edge between two highlights with an editable label and a delete button. */
export function LinkEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<LinkEdgeType>) {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const update = useStore((s) => s.update)
  const editing = useUiStore((s) => s.editingLinkId === data?.linkId)
  const setEditingLink = useUiStore((s) => s.setEditingLink)
  const [draft, setDraft] = useState(data?.label ?? '')
  if (!data) return null
  const { linkId, label } = data

  function commit() {
    update((s) => setLinkLabel(s, linkId, draft))
    setEditingLink(null)
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: '#6b7280', strokeWidth: 1.5 }} />
      {/* EdgeLabelRenderer puts HTML (not SVG) at the label position, so inputs and buttons work. */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan group absolute flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs shadow"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
        >
          {editing ? (
            <input
              className="w-28 outline-none"
              value={draft}
              placeholder="label"
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(label ?? '')
                  setEditingLink(null)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className={label ? '' : 'text-gray-400'}
              title="Edit label"
              onClick={() => {
                setDraft(label ?? '')
                setEditingLink(linkId)
              }}
            >
              {label ?? 'label'}
            </button>
          )}
          <button
            type="button"
            className="rounded px-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100"
            title="Delete link"
            onClick={() => update((s) => deleteLink(s, linkId))}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
