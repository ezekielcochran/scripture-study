import { useId } from 'react'

const W = 200
const H = 100
const CX = W / 2
const CY = H / 2
const SQUASH = 0.48

interface Pt {
  x: number
  y: number
}

/** Points along a logarithmic spiral r = r0·e^(kθ), squashed vertically into the oval. */
function spiralPoints(phase: number, turns: number, r0 = 3, rMax = CX - 4): Pt[] {
  const thetaMax = turns * 2 * Math.PI
  const k = Math.log(rMax / r0) / thetaMax
  const pts: Pt[] = []
  for (let t = 0; t <= thetaMax + 1e-6; t += 0.1) {
    const r = r0 * Math.exp(k * t)
    pts.push({ x: CX + r * Math.cos(t + phase), y: CY + r * Math.sin(t + phase) * SQUASH })
  }
  return pts
}

/**
 * A tapered arm: a closed polygon around the spiral, thin at the core and wide
 * at the tip, so the arms themselves form the galaxy's ragged outline.
 */
function armPolygon(phase: number, turns: number, w0: number, w1: number): string {
  const pts = spiralPoints(phase, turns)
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(pts.length - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    // Normal to the path, squashed like the spiral so the arm stays oval.
    const nx = (-dy / len) * 1
    const ny = (dx / len) * SQUASH
    const f = i / (pts.length - 1)
    const w = (w0 + (w1 - w0) * f ** 1.4) / 2
    left.push(`${(pts[i].x + nx * w).toFixed(1)},${(pts[i].y + ny * w).toFixed(1)}`)
    right.push(`${(pts[i].x - nx * w).toFixed(1)},${(pts[i].y - ny * w).toFixed(1)}`)
  }
  return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`
}

const MAIN_ARMS = [armPolygon(0, 1.45, 3, 22), armPolygon(Math.PI, 1.45, 3, 22)]
const FAINT_ARMS = [armPolygon(Math.PI / 2, 1.2, 2, 14), armPolygon((3 * Math.PI) / 2, 1.2, 2, 14)]

// Fixed pseudo-random stars so the glyph is stable between renders.
const STARS = Array.from({ length: 30 }, (_, i) => {
  const a = i * 2.399963 // golden angle: even spread
  const r = 0.2 + ((i * 7919) % 100) / 125
  return {
    x: CX + Math.cos(a) * r * CX * 0.98,
    y: CY + Math.sin(a) * r * CY * 0.98,
    s: 0.5 + ((i * 104729) % 10) / 12,
    o: 0.35 + ((i * 31) % 6) / 10,
  }
})

/** The galaxy artwork for a portal: fills its box, decorative only. */
export function PortalGlyph() {
  // useId keeps gradient/filter ids unique when many portals are on the canvas.
  const uid = useId().replace(/:/g, '')
  const g = (name: string) => `${uid}-${name}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={g('haze')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2e1f6e" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#1a1246" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0b0620" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('core')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#ffe9c4" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#c084fc" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('arm')} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#bfdbfe" stopOpacity="0.75" />
          <stop offset="75%" stopColor="#7c3aed" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.15" />
        </radialGradient>
        <filter id={g('soft')} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={g('blur')} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Dusty core region: a soft glow smaller than the box, so the arms reach past it. */}
      <ellipse cx={CX} cy={CY} rx={CX * 0.78} ry={CY * 0.78} fill={`url(#${g('haze')})`} filter={`url(#${g('blur')})`} />

      {/* Spiral arms give the outline; faint ones fill between the bright ones. */}
      {FAINT_ARMS.map((d, i) => (
        <path key={`f${i}`} d={d} fill="#6d28d9" opacity="0.45" filter={`url(#${g('blur')})`} />
      ))}
      {MAIN_ARMS.map((d, i) => (
        <g key={i}>
          <path d={d} fill="#4c1d95" opacity="0.9" filter={`url(#${g('blur')})`} />
          <path d={d} fill={`url(#${g('arm')})`} filter={`url(#${g('soft')})`} />
        </g>
      ))}

      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />
      ))}

      <ellipse cx={CX} cy={CY} rx="28" ry="13" fill={`url(#${g('core')})`} />
    </svg>
  )
}
