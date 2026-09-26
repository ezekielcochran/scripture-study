import { ReactFlow, Background } from '@xyflow/react'
import { useStore } from '../store/store'
import { layoutToNodes } from '../lib/layout'
import { WindowNode } from './WindowNode'
import { PresetLegend } from './PresetLegend'
import { Toolbar } from './Toolbar'
import { useHighlightShortcuts } from './useHighlightShortcuts'

// React Flow requires nodeTypes to be a stable reference (defined once, outside
// the component); otherwise it re-creates every node on each render.
const nodeTypes = { window: WindowNode }

export function Canvas() {
  const layout = useStore((s) => s.state.layouts[0])
  const nodes = layoutToNodes(layout)
  useHighlightShortcuts()

  return (
    <ReactFlow nodes={nodes} nodeTypes={nodeTypes} minZoom={0.2} maxZoom={4}>
      <Background />
      <PresetLegend />
      <Toolbar />
    </ReactFlow>
  )
}
