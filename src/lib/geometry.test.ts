import { describe, expect, test } from 'vitest'
import { clampToRect, exitPoint, isDegenerate, linkEndpoints, linkPieces, nearestEdgePoint } from './geometry'

const r = { x: 100, y: 100, width: 200, height: 100 } // spans x 100..300, y 100..200

describe('clampToRect', () => {
  test('leaves inside points alone and clamps outside ones', () => {
    expect(clampToRect({ x: 150, y: 150 }, r)).toEqual({ x: 150, y: 150 })
    expect(clampToRect({ x: 0, y: 150 }, r)).toEqual({ x: 100, y: 150 })
    expect(clampToRect({ x: 400, y: 400 }, r)).toEqual({ x: 300, y: 200 })
  })
})

describe('nearestEdgePoint', () => {
  test('outside points project onto the boundary', () => {
    expect(nearestEdgePoint(r, { x: 500, y: 150 })).toEqual({ x: 300, y: 150 })
    expect(nearestEdgePoint(r, { x: 150, y: 0 })).toEqual({ x: 150, y: 100 })
    expect(nearestEdgePoint(r, { x: 0, y: 0 })).toEqual({ x: 100, y: 100 })
  })

  test('inside points go to the nearest side', () => {
    expect(nearestEdgePoint(r, { x: 110, y: 150 })).toEqual({ x: 100, y: 150 })
    expect(nearestEdgePoint(r, { x: 290, y: 150 })).toEqual({ x: 300, y: 150 })
    expect(nearestEdgePoint(r, { x: 200, y: 105 })).toEqual({ x: 200, y: 100 })
    expect(nearestEdgePoint(r, { x: 200, y: 195 })).toEqual({ x: 200, y: 200 })
  })
})

describe('linkEndpoints', () => {
  const left = { x: 0, y: 0, width: 100, height: 100 }
  const right = { x: 300, y: 0, width: 100, height: 100 }

  test('document to document: both ends on the facing edges', () => {
    expect(linkEndpoints({ rect: left }, { rect: right })).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
    ])
  })

  test('highlight to document: highlight stays put, document end faces it', () => {
    const [a, b] = linkEndpoints({ rect: left, anchor: { x: 20, y: 80 } }, { rect: right })
    expect(a).toEqual({ x: 20, y: 80 })
    expect(b).toEqual({ x: 300, y: 80 })
  })

  test('document to highlight: document end faces the highlight', () => {
    const [a, b] = linkEndpoints({ rect: right }, { rect: left, anchor: { x: 20, y: 80 } })
    expect(a).toEqual({ x: 300, y: 80 })
    expect(b).toEqual({ x: 20, y: 80 })
  })

  test('a highlight scrolled out of its window is clamped to the window edge', () => {
    const [a] = linkEndpoints({ rect: left, anchor: { x: 20, y: 400 } }, { rect: right })
    expect(a).toEqual({ x: 20, y: 100 })
  })

  test('highlight to highlight keeps both anchors', () => {
    expect(linkEndpoints({ rect: left, anchor: { x: 1, y: 2 } }, { rect: right, anchor: { x: 301, y: 2 } })).toEqual([
      { x: 1, y: 2 },
      { x: 301, y: 2 },
    ])
  })
})

describe('exitPoint', () => {
  const r = { x: 0, y: 0, width: 100, height: 100 }
  test('finds where the segment leaves the rectangle', () => {
    expect(exitPoint(r, { x: 50, y: 50 }, { x: 250, y: 50 })).toEqual({ x: 100, y: 50 })
    expect(exitPoint(r, { x: 50, y: 50 }, { x: 50, y: -50 })).toEqual({ x: 50, y: 0 })
    expect(exitPoint(r, { x: 50, y: 50 }, { x: 150, y: 150 })).toEqual({ x: 100, y: 100 })
  })
  test('a point already on the boundary heading out exits immediately', () => {
    expect(exitPoint(r, { x: 100, y: 50 }, { x: 300, y: 50 })).toEqual({ x: 100, y: 50 })
  })
  test('a target inside the rectangle means no exit', () => {
    expect(exitPoint(r, { x: 50, y: 50 }, { x: 60, y: 60 })).toEqual({ x: 60, y: 60 })
  })
})

describe('linkPieces', () => {
  const left = { x: 0, y: 0, width: 100, height: 100 }
  const right = { x: 300, y: 0, width: 100, height: 100 }

  test('highlight to highlight: leads inside each window, span between', () => {
    const p = linkPieces({ rect: left, anchor: { x: 50, y: 50 } }, { rect: right, anchor: { x: 350, y: 50 } })
    expect(p.a).toEqual([{ x: 50, y: 50 }, { x: 100, y: 50 }])
    expect(p.mid).toEqual([{ x: 100, y: 50 }, { x: 300, y: 50 }])
    expect(p.b).toEqual([{ x: 300, y: 50 }, { x: 350, y: 50 }])
    expect(isDegenerate(p.a)).toBe(false)
  })

  test('document ends have zero-length leads', () => {
    const p = linkPieces({ rect: left }, { rect: right })
    expect(isDegenerate(p.a)).toBe(true)
    expect(isDegenerate(p.b)).toBe(true)
    expect(p.mid).toEqual([{ x: 100, y: 50 }, { x: 300, y: 50 }])
  })
})
