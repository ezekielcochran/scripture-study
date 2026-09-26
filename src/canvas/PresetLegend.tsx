import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { presetStyleToCss } from '../lib/style'

/** Lists presets and their shortcuts so the keyboard flow is discoverable. */
export function PresetLegend() {
  const presets = useStore((s) => s.state.presets)
  return (
    <Panel position="top-left" className="rounded border border-line bg-surface px-3 py-2 text-sm shadow">
      <div className="mb-1 text-xs text-muted">Select text, then press a key.<br />Click highlights or window Link buttons to connect them.</div>
      <ul className="space-y-0.5">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-xs">
              {p.shortcut ?? '–'}
            </kbd>
            <span className="rounded px-1" style={presetStyleToCss(p.style)}>
              {p.name}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
