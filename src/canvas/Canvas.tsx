import { useCallback, useEffect } from 'react'
import { ReactFlow, Background, MarkerType, Panel, type NodeChange } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import {
  applyNodeChangesToState,
  historyOptionsForChanges,
  layoutToNodes,
  linksToEdges,
  type LinkEdge as LinkEdgeType,
  type WindowNode as WindowNodeType,
} from '../lib/layout'
import { WindowNode } from './WindowNode'
import { LinkEdge } from './LinkEdge'
import { PresetLegend } from './PresetLegend'
import { Toolbar } from './Toolbar'
import { MobileNotice } from './MobileNotice'
import { useHighlightShortcuts } from './useHighlightShortcuts'
import { LINK_KEEP_ATTR } from './linking'
import { useUndoShortcuts } from './useUndoShortcuts'

// React Flow requires nodeTypes/edgeTypes to be stable references (defined once,
// outside the component); otherwise it re-creates every node on each render.
const nodeTypes = { window: WindowNode }
const edgeTypes = { link: LinkEdge }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--link)' } }

export function Canvas() {
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  const linkSource = useUiStore((s) => s.linkSource)
  const setLinkSource = useUiStore((s) => s.setLinkSource)
  const setEditingLink = useUiStore((s) => s.setEditingLink)
  const editingLinkId = useUiStore((s) => s.editingLinkId)
  const layout = state.layouts[0]
  const nodes = layoutToNodes(layout)
  const edges = linksToEdges(state, layout, { elevateLinkId: editingLinkId })
  useHighlightShortcuts()
  useUndoShortcuts()

  // The armed state is transient: Escape, or a click on anything that is not a
  // valid link target, cancels it. The click listener runs after React's own
  // handlers, so a click that arms or links has already happened by then.
  useEffect(() => {
    if (linkSource === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkSource(null)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null
      if (!target?.closest(`[${LINK_KEEP_ATTR}]`)) setLinkSource(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [linkSource, setLinkSource])

  // Nodes are fully controlled: React Flow reports drags, resizes, and clicks as
  // changes, and we fold them into the State so the layout is the only source of truth.
  const onNodesChange = useCallback(
    (changes: NodeChange<WindowNodeType>[]) =>
      update((s) => applyNodeChangesToState(s, changes), historyOptionsForChanges(changes)),
    [update],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodesChange={onNodesChange}
      onEdgeClick={(_, edge) => setEditingLink((edge as LinkEdgeType).data?.linkId ?? null)}
      // Clicking the background ends whatever is in progress, like Escape.
      onPaneClick={() => {
        setEditingLink(null)
        setLinkSource(null)
      }}
      elevateNodesOnSelect={false}
      deleteKeyCode={null}
      colorMode="system"
      minZoom={0.2}
      maxZoom={4}
    >
      <Background bgColor="var(--bg)" color="var(--dots)" gap={20} size={1.6} />
      <PresetLegend />
      <Toolbar />
      <MobileNotice />
      {layout.windows.length === 0 && (
        <Panel position="top-center" className="mt-24! text-sm text-muted">
          No windows open. Use <b>New document</b> or <b>Documents</b> above.
        </Panel>
      )}
      {linkSource !== null && (
        <Panel position="bottom-center" className="rounded border border-accent bg-surface px-3 py-1.5 text-sm text-ink shadow">
          Linking: click a highlight or a window's <b>Link</b> button to connect, press <b>New note</b> to attach a
          note, press a preset key to toggle the armed highlight's format, or Esc to cancel.
        </Panel>
      )}
    </ReactFlow>
  )
}
