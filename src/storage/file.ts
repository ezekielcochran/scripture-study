import type { State } from '../model/types'
import { deserialize, serialize, type ParseResult } from './envelope'

/** Build the export file name for a given date, e.g. text-study-2026-09-26.json */
export function exportFileName(now: Date = new Date()): string {
  return `text-study-${now.toISOString().slice(0, 10)}.json`
}

/** Trigger a browser download of the state as a JSON file. */
export function downloadStateFile(state: State): void {
  const blob = new Blob([serialize(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName()
  a.click()
  URL.revokeObjectURL(url)
}

/** Read and validate a JSON file chosen by the user. */
export async function readStateFile(file: Blob): Promise<ParseResult> {
  return deserialize(await file.text())
}
