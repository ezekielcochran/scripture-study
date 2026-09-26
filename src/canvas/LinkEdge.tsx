import { useRef } from 'react'
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { deleteLink, setLinkLabel } from '../model/actions'
import type { LinkEdge as LinkEdgeType } from '../lib/layout'

/**
 * A straight edge between two highlights. By default it is just the line; a label
 * box appears only when the link has a label or the user clicked the line to edit it.
 */
export function LinkEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<LinkEdgeType>) {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const update = useStore((s) => s.update)
  const editing = useUiStore((s) => s.editingLinkId === data?.linkId)
  const setEditingLink = useUiStore((s) => s.setEditingLink)
  const label = data?.label
  // Uncontrolled input: it mounts fresh for each editing session with the saved label,
  // and we read its value on commit, so no draft state is needed.
  const inputRef = useRef<HTMLInputElement>(null)

  if (!data) return null
  const { linkId } = data

  function commit() {
    const value = inputRef.current?.value ?? ''
    update((s) => setLinkLabel(s, linkId, value))
    setEditingLink(null)
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: '#6b7280', strokeWidth: 1.5 }} />
      {(label || editing) && (
        // EdgeLabelRenderer puts HTML (not SVG) at the label position, so inputs and buttons work.
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan group absolute flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs shadow"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          >
            {editing ? (
              <input
                ref={inputRef}
                className="w-28 outline-none"
                defaultValue={label ?? ''}
                placeholder="label"
                autoFocus
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setEditingLink(null)
                }}
              />
            ) : (
              <button type="button" title="Edit label" onClick={() => setEditingLink(linkId)}>
                {label}
              </button>
            )}
            <button
              type="button"
              className={`rounded px-1 text-gray-400 hover:bg-gray-100 ${editing ? '' : 'opacity-0 group-hover:opacity-100'}`}
              title="Delete link"
              // onMouseDown so the click lands before the input's blur commits and closes the box.
              onMouseDown={(e) => {
                e.preventDefault()
                update((s) => deleteLink(s, linkId))
                setEditingLink(null)
              }}
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
