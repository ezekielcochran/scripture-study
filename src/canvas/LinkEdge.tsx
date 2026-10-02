import { useRef } from 'react'
import { BaseEdge, getStraightPath, useInternalNode, type EdgeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { deleteLink, setLinkLabel } from '../model/actions'
import { isDocumentHandle, type LinkEdge as LinkEdgeType } from '../lib/layout'
import { isDegenerate, linkPieces, type EdgeEnd, type LinkPart, type Point, type Rect } from '../lib/geometry'

/** Screen rectangle of a window node, or null until React Flow has measured it. */
function useNodeRect(id: string): Rect | null {
  const node = useInternalNode(id)
  if (!node) return null
  const width = node.measured.width ?? node.width
  const height = node.measured.height ?? node.height
  if (width === undefined || height === undefined) return null
  return { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y, width, height }
}

const LABEL_BOX = { width: 240, height: 32 }

/**
 * One piece of a straight link between two ends (see linkPieces): the lead
 * inside window A, the span between windows, or the lead inside window B.
 * Document ends snap to the nearest edge of their window; highlight ends sit at
 * the highlight, clamped into the window. The label rides on the span piece and
 * lives inside the edge's own SVG so it is layered with the line.
 */
export function LinkEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceHandleId,
  targetHandleId,
  data,
  markerEnd,
}: EdgeProps<LinkEdgeType>) {
  const sourceRect = useNodeRect(source)
  const targetRect = useNodeRect(target)
  const update = useStore((s) => s.update)
  const editing = useUiStore((s) => s.editingLinkId === data?.linkId)
  const setEditingLink = useUiStore((s) => s.setEditingLink)
  const label = data?.label
  // Uncontrolled input: it mounts fresh for each editing session with the saved label,
  // and we read its value on commit, so no draft state is needed.
  const inputRef = useRef<HTMLInputElement>(null)

  if (!data) return null
  const { linkId, part } = data

  const rawA: Point = { x: sourceX, y: sourceY }
  const rawB: Point = { x: targetX, y: targetY }
  let pieces: Record<LinkPart, [Point, Point]>
  if (sourceRect && targetRect) {
    const endA: EdgeEnd = { rect: sourceRect, ...(isDocumentHandle(sourceHandleId) ? {} : { anchor: rawA }) }
    const endB: EdgeEnd = { rect: targetRect, ...(isDocumentHandle(targetHandleId) ? {} : { anchor: rawB }) }
    pieces = linkPieces(endA, endB)
  } else {
    // Until both windows are measured, draw the whole line as the span piece.
    pieces = { a: [rawA, rawA], mid: [rawA, rawB], b: [rawB, rawB] }
  }
  const [p, q] = pieces[part]
  const empty = isDegenerate(pieces[part])
  // The arrowhead goes on the last piece that actually has length.
  const lastPart: LinkPart = !isDegenerate(pieces.b) ? 'b' : !isDegenerate(pieces.mid) ? 'mid' : 'a'
  const [path] = getStraightPath({ sourceX: p.x, sourceY: p.y, targetX: q.x, targetY: q.y })
  // The label sits at the midpoint of the whole link, on the span piece.
  const labelX = (pieces.a[0].x + pieces.b[1].x) / 2
  const labelY = (pieces.a[0].y + pieces.b[1].y) / 2

  function commit() {
    const value = inputRef.current?.value ?? ''
    update((s) => setLinkLabel(s, linkId, value))
    setEditingLink(null)
  }

  return (
    <>
      {!empty && (
        // Leads run over window text, so they must not catch the pointer or they would
        // block text selection; only the span between windows is clickable (for labels).
        <BaseEdge
          id={id}
          path={path}
          markerEnd={part === lastPart ? markerEnd : undefined}
          interactionWidth={part === 'mid' ? 20 : 0}
          style={{ stroke: 'var(--link)', strokeWidth: 1.25, pointerEvents: part === 'mid' ? undefined : 'none' }}
        />
      )}
      {part === 'mid' && (label || editing) && (
        // foreignObject keeps the HTML label inside this edge's SVG layer, so it
        // is covered by the same windows that cover the line.
        <foreignObject
          x={labelX - LABEL_BOX.width / 2}
          y={labelY - LABEL_BOX.height / 2}
          width={LABEL_BOX.width}
          height={LABEL_BOX.height}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="nodrag nopan group flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-xs shadow"
              style={{ pointerEvents: 'all' }}
            >
              {editing ? (
                <input
                  ref={inputRef}
                  className="w-28 bg-transparent text-ink outline-none"
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
                className={`rounded px-1 text-muted hover:bg-surface-3 ${editing ? '' : 'opacity-0 group-hover:opacity-100'}`}
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
          </div>
        </foreignObject>
      )}
    </>
  )
}
