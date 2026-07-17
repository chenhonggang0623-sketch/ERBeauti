export function generateId(prefix?: string): string {
  const id = Math.random().toString(36).slice(2, 9)
  return prefix ? `${prefix}_${id}` : id
}
