export function updateRow<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((r) => (r.id === id ? { ...r, ...patch } : r))
}

export function removeRow<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((r) => r.id !== id)
}
