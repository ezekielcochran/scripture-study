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

// Four bright arms and four fainter ones between them, so the disc reads as one swirl.
const MAIN_ARMS = [0, 1, 2, 3].map((i) => armPolygon((i * Math.PI) / 2, 1.35, 2, 16))
const FAINT_ARMS = [0, 1, 2, 3].map((i) => armPolygon((i * Math.PI) / 2 + Math.PI / 4, 1.2, 2, 12))

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
          <stop offset="0%" stopColor="#0d0824" />
          <stop offset="55%" stopColor="#140d33" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0b0620" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('core')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5d0fe" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('arm')} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.25" />
          <stop offset="35%" stopColor="#bfdbfe" stopOpacity="0.6" />
          <stop offset="75%" stopColor="#7c3aed" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.15" />
        </radialGradient>
        <filter id={g('soft')} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={g('blur')} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={g('wide')} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Dusty body: a wide soft haze that the arms grow out of, so nothing floats detached. */}
      <ellipse cx={CX} cy={CY} rx={CX * 0.92} ry={CY * 0.9} fill={`url(#${g('haze')})`} filter={`url(#${g('wide')})`} />

      {/* Dark underlay of every arm, heavily blurred, merges them into one silhouette. */}
      {[...MAIN_ARMS, ...FAINT_ARMS].map((d, i) => (
        <path key={`u${i}`} d={d} fill="#2e1065" opacity="0.55" filter={`url(#${g('blur')})`} />
      ))}
      {/* Bright arm light blends additively where arms overlap. */}
      <g style={{ mixBlendMode: 'screen' }}>
        {FAINT_ARMS.map((d, i) => (
          <path key={`f${i}`} d={d} fill="#7c3aed" opacity="0.45" filter={`url(#${g('blur')})`} />
        ))}
        {MAIN_ARMS.map((d, i) => (
          <path key={i} d={d} fill={`url(#${g('arm')})`} opacity="0.85" filter={`url(#${g('soft')})`} />
        ))}
      </g>

      {/* Dark pad behind the name so it stays readable over the arms. */}
      <ellipse cx={CX} cy={CY} rx="58" ry="26" fill="#0b0620" opacity="0.85" filter={`url(#${g('blur')})`} />

      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />
      ))}

      <ellipse cx={CX} cy={CY} rx="40" ry="18" fill={`url(#${g('core')})`} />
    </svg>
  )
}
