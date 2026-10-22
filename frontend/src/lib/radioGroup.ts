import type { KeyboardEvent } from 'react'

const STEP: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

export function nextRadioIndex(key: string, index: number, count: number): number | null {
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const step = STEP[key]
  return step === undefined ? null : (index + step + count) % count
}

interface RadioKeyOptions<T> {
  values: readonly T[]
  current: T
  onSelect: (value: T) => void
}

export function radioKeyHandler<T>({ values, current, onSelect }: RadioKeyOptions<T>) {
  return (event: KeyboardEvent<HTMLElement>) => {
    const next = nextRadioIndex(event.key, values.indexOf(current), values.length)
    if (next === null) return
    event.preventDefault()
    onSelect(values[next])
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }
}
