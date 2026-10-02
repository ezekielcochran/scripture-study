import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import { createPortal, createWorkspaceWithPortal } from '../model/actions'
import { PORTAL_SIZE } from '../lib/layout'
import { Dialog } from './Dialog'

/** Add a portal from the current workspace to an existing workspace, or to a new named one. */
export function PortalDialog({ onClose }: { onClose: () => void }) {
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  const { screenToFlowPosition } = useReactFlow()
  const others = state.workspaces.filter((w) => w.id !== state.currentWorkspaceId)
  const [mode, setMode] = useState<'existing' | 'new'>(others.length ? 'existing' : 'new')
  const [targetId, setTargetId] = useState(others[0]?.id ?? '')
  const [name, setName] = useState('')

  const canCreate = mode === 'existing' ? targetId !== '' : name.trim() !== ''

  function create() {
    if (!canCreate) return
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const placement = { x: Math.round(center.x - PORTAL_SIZE.width / 2), y: Math.round(center.y - PORTAL_SIZE.height / 2) }
    const from = state.currentWorkspaceId
    if (mode === 'existing') update((s) => createPortal(s, from, targetId, placement))
    else update((s) => createWorkspaceWithPortal(s, from, name, placement))
    onClose()
  }

  const field = 'w-full rounded border border-line bg-surface px-2 py-1 text-ink text-sm focus:border-muted focus:outline-none'
  return (
    <Dialog title="New portal" onClose={onClose}>
      <p className="mb-3 text-xs text-muted">
        A portal is two-sided: its counterpart appears in the other workspace. A new workspace starts with this
        workspace’s presets.
      </p>
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="radio" name="portal-mode" checked={mode === 'existing'} disabled={others.length === 0} onChange={() => setMode('existing')} />
        <span className={others.length === 0 ? 'text-muted' : ''}>Connect to an existing workspace</span>
      </label>
      {mode === 'existing' && (
        <select className={`${field} mb-3`} value={targetId} onChange={(e) => setTargetId(e.target.value)} autoFocus>
          {others.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="radio" name="portal-mode" checked={mode === 'new'} onChange={() => setMode('new')} />
        <span>Create a new workspace</span>
      </label>
      {mode === 'new' && (
        <input
          className={`${field} mb-3`}
          value={name}
          placeholder="Workspace name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
          }}
          autoFocus
        />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1 text-sm hover:bg-surface-3" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded bg-ink px-3 py-1 text-sm text-bg hover:opacity-90 disabled:opacity-40"
          disabled={!canCreate}
          onClick={create}
        >
          Create portal
        </button>
      </div>
    </Dialog>
  )
}
