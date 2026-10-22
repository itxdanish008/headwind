import { describe, expect, it } from 'vitest'
import { readStorage, writeStorage } from './storage'

function memoryStore(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  } as Storage
}

const blockedStore = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
} as unknown as Storage

describe('storage helpers', () => {
  it('reads and writes values', () => {
    const store = memoryStore()
    writeStorage(store, 'k', 'v')
    expect(readStorage(store, 'k')).toBe('v')
    expect(readStorage(store, 'missing')).toBeNull()
  })

  it('treats a blocked store as empty instead of throwing', () => {
    expect(readStorage(blockedStore, 'k')).toBeNull()
    expect(() => writeStorage(blockedStore, 'k', 'v')).not.toThrow()
  })
})
