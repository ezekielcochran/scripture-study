import { useCallback, useEffect } from 'react'
import { ReactFlow, Background, MarkerType, Panel, type NodeChange } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import {
  applyNodeChangesToState,
  layoutToNodes,
  linksToEdges,
  type LinkEdge as LinkEdgeType,
  type WindowNode as WindowNodeType,
} from '../lib/layout'
import { WindowNode } from './WindowNode'
import { LinkEdge } from './LinkEdge'
import { PresetLegend } from './PresetLegend'
import { Toolbar } from './Toolbar'
import { useHighlightShortcuts } from './useHighlightShortcuts'

// React Flow requires nodeTypes/edgeTypes to be stable references (defined once,
// outside the component); otherwise it re-creates every node on each render.
const nodeTypes = { window: WindowNode }
const edgeTypes = { link: LinkEdge }
const defaultEdgeOptions = { markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' } }

export function Canvas() {
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  const linkSource = useUiStore((s) => s.linkSource)
  const setLinkSource = useUiStore((s) => s.setLinkSource)
  const setEditingLink = useUiStore((s) => s.setEditingLink)
  const layout = state.layouts[0]
  const nodes = layoutToNodes(layout)
  const edges = linksToEdges(state, layout)
  useHighlightShortcuts()

  // Escape cancels a pending link.
  useEffect(() => {
    if (linkSource === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkSource(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [linkSource, setLinkSource])

  // Nodes are fully controlled: React Flow reports drags, resizes, and clicks as
  // changes, and we fold them into the State so the layout is the only source of truth.
  const onNodesChange = useCallback(
    (changes: NodeChange<WindowNodeType>[]) => update((s) => applyNodeChangesToState(s, changes)),
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
      onPaneClick={() => setEditingLink(null)}
      elevateNodesOnSelect={false}
      deleteKeyCode={null}
      minZoom={0.2}
      maxZoom={4}
    >
      <Background />
      <PresetLegend />
      <Toolbar />
      {layout.windows.length === 0 && (
        <Panel position="top-center" className="mt-24! text-sm text-gray-500">
          No windows open. Use <b>New document</b> or <b>Open document</b> above.
        </Panel>
      )}
      {linkSource !== null && (
        <Panel position="bottom-center" className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-800 shadow">
          Linking: click another highlight to connect, or press Esc to cancel.
        </Panel>
      )}
    </ReactFlow>
  )
}
