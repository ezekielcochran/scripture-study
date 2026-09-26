import { useCallback } from 'react'
import { ReactFlow, Background, Panel, type NodeChange } from '@xyflow/react'
import { useStore } from '../store/store'
import { applyNodeChangesToState, layoutToNodes, type WindowNode as WindowNodeType } from '../lib/layout'
import { WindowNode } from './WindowNode'
import { PresetLegend } from './PresetLegend'
import { Toolbar } from './Toolbar'
import { useHighlightShortcuts } from './useHighlightShortcuts'

// React Flow requires nodeTypes to be a stable reference (defined once, outside
// the component); otherwise it re-creates every node on each render.
const nodeTypes = { window: WindowNode }

export function Canvas() {
  const layout = useStore((s) => s.state.layouts[0])
  const update = useStore((s) => s.update)
  const nodes = layoutToNodes(layout)
  useHighlightShortcuts()

  // Nodes are fully controlled: React Flow reports drags, resizes, and clicks as
  // changes, and we fold them into the State so the layout is the only source of truth.
  const onNodesChange = useCallback(
    (changes: NodeChange<WindowNodeType>[]) => update((s) => applyNodeChangesToState(s, changes)),
    [update],
  )

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
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
    </ReactFlow>
  )
}
