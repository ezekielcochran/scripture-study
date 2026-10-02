import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { switchWorkspace } from '../model/actions'

/** Shows the current workspace and lets the user jump to any other. */
export function WorkspaceBar() {
  const workspaces = useStore((s) => s.state.workspaces)
  const currentId = useStore((s) => s.state.currentWorkspaceId)
  const update = useStore((s) => s.update)
  return (
    <Panel position="bottom-left" className="flex items-center gap-2 rounded border border-line bg-surface px-2 py-1 text-sm shadow">
      <span className="text-xs text-muted">Workspace</span>
      {/* A native select keeps this keyboard-accessible with no extra code. */}
      <select
        className="rounded border border-line bg-surface px-1 py-0.5 text-sm text-ink focus:outline-none"
        value={currentId}
        onChange={(e) => {
          useUiStore.getState().setLinkSource(null)
          update((s) => switchWorkspace(s, e.target.value), { skip: true })
        }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </Panel>
  )
}
