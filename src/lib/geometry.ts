export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

/** The closest point inside (or on) the rectangle to `p`. */
export function clampToRect(p: Point, r: Rect): Point {
  return {
    x: Math.min(Math.max(p.x, r.x), r.x + r.width),
    y: Math.min(Math.max(p.y, r.y), r.y + r.height),
  }
}

/**
 * The closest point on the rectangle's boundary to `p`. For a point outside the
 * rectangle this is the clamped point; for a point inside, the nearest side.
 */
export function nearestEdgePoint(r: Rect, p: Point): Point {
  const c = clampToRect(p, r)
  const inside = c.x === p.x && c.y === p.y
  if (!inside) return c
  const left = p.x - r.x
  const right = r.x + r.width - p.x
  const top = p.y - r.y
  const bottom = r.y + r.height - p.y
  const min = Math.min(left, right, top, bottom)
  if (min === left) return { x: r.x, y: p.y }
  if (min === right) return { x: r.x + r.width, y: p.y }
  if (min === top) return { x: p.x, y: r.y }
  return { x: p.x, y: r.y + r.height }
}

/**
 * Where a line from the rectangle's centre toward `p` leaves the rectangle, so
 * a link attaches to the side facing `p` rather than snapping to a corner.
 * If `p` is inside the rectangle, falls back to the nearest side.
 */
export function edgeToward(r: Rect, p: Point): Point {
  const c = rectCenter(r)
  const inside = clampToRect(p, r).x === p.x && clampToRect(p, r).y === p.y
  return inside ? nearestEdgePoint(r, p) : exitPoint(r, c, p)
}

/** One end of a link on screen: its window and, for highlight ends, the highlight's own point. */
export interface EdgeEnd {
  rect: Rect
  /** Present for highlight ends; absent for document ends. */
  anchor?: Point
}

/**
 * Where a link's line starts and ends. Highlight ends sit at the highlight,
 * clamped into the window so a scrolled-away highlight anchors at the window
 * edge. Document ends sit where the line from the window's centre toward the
 * other end crosses the window edge, biased to the centre rather than a corner.
 */
export function linkEndpoints(a: EdgeEnd, b: EdgeEnd): [Point, Point] {
  const provisionalB = b.anchor ? clampToRect(b.anchor, b.rect) : rectCenter(b.rect)
  const pa = a.anchor ? clampToRect(a.anchor, a.rect) : edgeToward(a.rect, provisionalB)
  const pb = b.anchor ? provisionalB : edgeToward(b.rect, pa)
  return [pa, pb]
}

/**
 * Where the segment from `from` (inside or on `rect`) toward `to` leaves the
 * rectangle. If `to` is inside too, the segment never leaves and `to` is returned.
 */
export function exitPoint(rect: Rect, from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const tx = dx > 0 ? (rect.x + rect.width - from.x) / dx : dx < 0 ? (rect.x - from.x) / dx : Infinity
  const ty = dy > 0 ? (rect.y + rect.height - from.y) / dy : dy < 0 ? (rect.y - from.y) / dy : Infinity
  const t = Math.max(0, Math.min(tx, ty, 1))
  return { x: from.x + t * dx, y: from.y + t * dy }
}

export type LinkPart = 'a' | 'mid' | 'b'

/**
 * A link drawn in three pieces so each can be layered separately: the lead
 * inside window A, the span between the windows, and the lead inside window B.
 */
export function linkPieces(a: EdgeEnd, b: EdgeEnd): Record<LinkPart, [Point, Point]> {
  const [pa, pb] = linkEndpoints(a, b)
  const exitA = exitPoint(a.rect, pa, pb)
  const exitB = exitPoint(b.rect, pb, pa)
  return { a: [pa, exitA], mid: [exitA, exitB], b: [exitB, pb] }
}

export function isDegenerate([p, q]: [Point, Point]): boolean {
  return Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) < 0.01
}
