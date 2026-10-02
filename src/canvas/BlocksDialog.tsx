import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import {
  blockLabel,
  blocksIn,
  deleteBlock,
  deleteLink,
  deletePortal,
  deleteWorkspace,
  describeLinkEnd,
  elementsIn,
  findOpenWindow,
  isNote,
  linksIn,
  nextWindowPlacement,
  openBlock,
  portalsIn,
  pruneLinks,
  renameWorkspace,
  setBlockTitle,
  switchWorkspace,
} from '../model/actions'
import type { Block, Portal } from '../model/types'
import { PORTAL_SIZE } from '../lib/layout'
import { useUiStore } from '../store/uiStore'
import { Dialog } from './Dialog'

/**
 * Manage the current workspace: rename or delete it; list, retitle, open (or
 * focus), and delete its blocks and notes; list and delete its links.
 * Edits apply immediately.
 */
export function BlocksDialog({ onClose }: { onClose: () => void }) {
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow()
  const ws = state.currentWorkspaceId
  const workspace = state.workspaces.find((w) => w.id === ws)!
  const blocks = blocksIn(state, ws)
  const links = linksIn(state, ws)
  const portals = portalsIn(state, ws)
  const workspaceName = (id: string) => state.workspaces.find((w) => w.id === id)?.name ?? '(missing)'

  function showPortal(p: Portal) {
    void setCenter(p.x + PORTAL_SIZE.width / 2, p.y + PORTAL_SIZE.height / 2, { zoom: getZoom(), duration: 300 })
    onClose()
  }

  function goThrough(p: Portal) {
    useUiStore.getState().setLinkSource(null)
    update((s) => switchWorkspace(s, p.targetWorkspaceId), { skip: true })
    onClose()
  }

  function show(block: Block) {
    const existing = findOpenWindow(state, block.id)
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    // Focusing an already-open window is not worth an undo step; opening a new one is.
    update((s) => openBlock(s, block.id, nextWindowPlacement(elementsIn(s, ws).length, center)), { skip: !!existing })
    if (existing) {
      // Pan to the window that was brought to the front, keeping the current zoom.
      void setCenter(existing.x + existing.width / 2, existing.y + existing.height / 2, { zoom: getZoom(), duration: 300 })
    }
    onClose()
  }

  function remove(block: Block) {
    const ids = new Set(state.highlights.filter((h) => h.blockId === block.id).map((h) => h.id))
    const touched = state.links.length - pruneLinks(state.links, { highlights: ids, blocks: new Set([block.id]) }).length
    const detail = ids.size || touched ? ` ${ids.size} highlight(s) and ${touched} link(s) will be removed.` : ''
    if (window.confirm(`Delete "${blockLabel(block)}"?${detail}`)) update((s) => deleteBlock(s, block.id))
  }

  function removeWorkspace() {
    const n = blocks.length
    const portals = state.portals.filter((p) => p.workspaceId === ws || p.targetWorkspaceId === ws).length / 2
    const msg = `Delete workspace "${workspace.name}" with its ${n} block(s) and ${portals} portal(s)? Undo can bring it back.`
    if (window.confirm(msg)) {
      update((s) => deleteWorkspace(s, ws))
      onClose()
    }
  }

  const field = 'w-full rounded border border-line bg-surface px-2 py-1 text-ink text-sm focus:border-muted focus:outline-none'
  const button = 'rounded border border-line px-2 py-1 text-sm hover:bg-surface-3'

  function section(items: Block[], emptyText: string, placeholder: string) {
    if (items.length === 0) return <div className="text-sm text-muted">{emptyText}</div>
    return (
      <ul className="space-y-2">
        {items.map((block) => {
          const open = findOpenWindow(state, block.id) !== undefined
          return (
            <li key={block.id} className="flex items-center gap-2">
              <input
                className={field}
                value={block.title ?? ''}
                placeholder={placeholder}
                onChange={(e) => update((s) => setBlockTitle(s, block.id, e.target.value), { key: `title:${block.id}` })}
              />
              <span className="w-24 shrink-0 truncate text-xs text-muted" title={block.text}>
                {block.text.length} chars
              </span>
              <button type="button" className={`${button} w-16 shrink-0`} onClick={() => show(block)}>
                {open ? 'Show' : 'Open'}
              </button>
              <button type="button" className={`${button} shrink-0 text-muted`} onClick={() => remove(block)}>
                Delete
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Dialog title="Blocks" onClose={onClose}>
      <h3 className="mb-1 text-sm font-medium">Workspace</h3>
      <div className="mb-4 flex items-center gap-2">
        <input
          className={field}
          value={workspace.name}
          onChange={(e) => update((s) => renameWorkspace(s, ws, e.target.value), { key: `ws-name:${ws}` })}
        />
        <button
          type="button"
          className={`${button} shrink-0 text-muted disabled:opacity-40`}
          disabled={state.workspaces.length <= 1}
          title={state.workspaces.length <= 1 ? 'The last workspace cannot be deleted' : 'Delete this workspace'}
          onClick={removeWorkspace}
        >
          Delete workspace
        </button>
      </div>
      <h3 className="mb-1 text-sm font-medium">Blocks</h3>
      {section(blocks.filter((b) => !isNote(b)), 'No blocks yet.', 'Untitled')}
      <h3 className="mt-4 mb-1 text-sm font-medium">Notes</h3>
      {section(blocks.filter(isNote), 'No notes yet. Use a window’s Note button to add one.', 'Untitled note')}
      <h3 className="mt-4 mb-1 text-sm font-medium">Portals</h3>
      {portals.length === 0 ? (
        <div className="text-sm text-muted">No portals yet. Use New portal to add one.</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {portals.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="min-w-0 grow truncate">
                <span className="text-muted">→</span> {workspaceName(p.targetWorkspaceId)}
              </span>
              <button type="button" className={`${button} shrink-0`} title="Pan to this portal" onClick={() => showPortal(p)}>
                Show
              </button>
              <button type="button" className={`${button} shrink-0`} title="Travel through this portal" onClick={() => goThrough(p)}>
                Go
              </button>
              <button
                type="button"
                className={`${button} shrink-0 text-muted`}
                title="Remove this portal (both sides)"
                onClick={() => update((s) => deletePortal(s, p.id))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-4 mb-1 text-sm font-medium">Links</h3>
      {links.length === 0 ? (
        <div className="text-sm text-muted">No links yet.</div>
      ) : (
        <ul className="max-h-60 space-y-1 overflow-auto text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="min-w-0 grow truncate">
                {describeLinkEnd(state, l.from)} <span className="text-muted">→</span> {describeLinkEnd(state, l.to)}
                {l.label && <span className="ml-2 text-xs text-muted">[{l.label}]</span>}
              </span>
              <button type="button" className={`${button} shrink-0 text-muted`} onClick={() => update((s) => deleteLink(s, l.id))}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
