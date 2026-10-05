const ACTIVE_TABLE_KEY = 'diferente-dmais-active-table'

export function getUnlockedTableId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TABLE_KEY)
  } catch {
    return null
  }
}

export function setUnlockedTableId(tableId: string) {
  try {
    localStorage.setItem(ACTIVE_TABLE_KEY, tableId)
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

export function clearUnlockedTableId() {
  try {
    localStorage.removeItem(ACTIVE_TABLE_KEY)
  } catch {
    // ignore
  }
}

export function isTableUnlocked(tableId: string): boolean {
  return getUnlockedTableId() === tableId
}
