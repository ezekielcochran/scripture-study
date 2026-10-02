import { useRef, type CSSProperties, type MouseEvent } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { deletePortal, switchWorkspace } from '../model/actions'
import { PORTAL_SIZE, portalHandleId, type PortalNode as PortalNodeType } from '../lib/layout'
import { PortalGlyph } from './PortalGlyph'
import { clickLinkEnd, isArmed, LINK_KEEP_ATTR } from './linking'

// Edges attach here. Invisible and not connectable: links are made with the link button.
const handleStyle: CSSProperties = { width: 1, height: 1, minWidth: 0, minHeight: 0, opacity: 0, border: 0, pointerEvents: 'none' }

/**
 * A doorway to another workspace: an oval, galaxy-like swirl showing the target
 * workspace's name. Click to travel; drag to move; × removes both sides.
 */
export function PortalNode({ data }: NodeProps<PortalNodeType>) {
  const portal = useStore((s) => s.state.portals.find((p) => p.id === data.portalId))
  const target = useStore((s) => s.state.workspaces.find((w) => w.id === portal?.targetWorkspaceId))
  const update = useStore((s) => s.update)
  const linkSource = useUiStore((s) => s.linkSource)
  const { setCenter, getZoom } = useReactFlow()
  const downAt = useRef<{ x: number; y: number } | null>(null)
  if (!portal || !target) return null
  const end = { kind: 'portal', id: portal.id } as const
  const armed = isArmed(linkSource, end)

  function travel(e: MouseEvent) {
    // A drag that happens to end here is not a click.
    const d = downAt.current
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
    useUiStore.getState().setLinkSource(null)
    const { state } = useStore.getState()
    const counterpart = state.portals.find((p) => p.pairId === portal!.pairId && p.id !== portal!.id)
    update((s) => switchWorkspace(s, target!.id), { skip: true })
    // Arrive looking at the matching portal on the other side.
    if (counterpart) {
      void setCenter(counterpart.x + PORTAL_SIZE.width / 2, counterpart.y + PORTAL_SIZE.height / 2, { zoom: getZoom() })
    }
  }

  return (
    <div
      className={`group relative h-full w-full cursor-pointer rounded-[50%] select-none ${armed ? 'outline-2 outline-dashed outline-accent' : ''}`}
      title={`Go to “${target.name}”`}
      onMouseDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY }
      }}
      onClick={travel}
    >
      <Handle type="source" position={Position.Left} id={portalHandleId(portal.id)} isConnectable={false} style={handleStyle} />
      <Handle type="target" position={Position.Left} id={portalHandleId(portal.id)} isConnectable={false} style={handleStyle} />
      <div className="absolute inset-0 transition-transform group-hover:scale-[1.04]">
        <PortalGlyph />
      </div>
      {/* The name wraps (up to three lines) inside the oval rather than truncating. */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <span
          className="line-clamp-3 text-center text-sm leading-tight font-semibold text-white [overflow-wrap:anywhere] [text-wrap:balance]"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.6)' }}
        >
          {target.name}
        </span>
      </div>
      <button
        type="button"
        className={`absolute top-1 left-3 rounded-full px-2 text-xs leading-5 text-white hover:bg-black/60 ${
          armed ? 'bg-accent' : 'bg-black/40 opacity-0 group-hover:opacity-100'
        }`}
        title="Link this portal: click to start or finish a link"
        {...{ [LINK_KEEP_ATTR]: '' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          clickLinkEnd(end)
        }}
      >
        Link
      </button>
      <button
        type="button"
        className="absolute top-1 right-3 rounded-full bg-black/40 px-1.5 text-xs leading-5 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60"
        title="Remove this portal (both sides)"
        onClick={(e) => {
          e.stopPropagation()
          update((s) => deletePortal(s, portal.id))
        }}
      >
        ×
      </button>
    </div>
  )
}
