/** Generate a unique id for any State entity. */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
