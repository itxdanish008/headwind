export function readStorage(store: Storage, key: string): string | null {
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value)
  } catch {
    return
  }
}
