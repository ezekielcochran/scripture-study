import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'

/** Lists presets and their shortcuts so the keyboard flow is discoverable. */
export function PresetLegend() {
  const presets = useStore((s) => s.state.presets)
  return (
    <Panel position="top-left" className="rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow">
      <div className="mb-1 text-xs text-gray-500">Select text, then press a key</div>
      <ul className="space-y-0.5">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <kbd className="rounded border border-gray-300 bg-gray-50 px-1 font-mono text-xs">
              {p.shortcut ?? '–'}
            </kbd>
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
