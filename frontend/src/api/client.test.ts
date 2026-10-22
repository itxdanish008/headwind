import { describe, expect, it } from 'vitest'
import { describeError } from './client'

describe('describeError', () => {
  it('prefers a service detail message', () => {
    expect(describeError({ detail: 'No truck route found.' })).toBe('No truck route found.')
  })

  it('labels known fields instead of showing raw field names', () => {
    expect(describeError({ departure_at: ['Departure must be within 14 days.'] })).toBe(
      'Departure: Departure must be within 14 days.',
    )
    expect(describeError({ load_lbs: ['Too heavy.'] })).toBe('Load: Too heavy.')
  })

  it('shows only the message for unknown fields', () => {
    expect(describeError({ surprise: ['Odd.'] })).toBe('Odd.')
  })

  it('has nothing to say about empty or non-object bodies', () => {
    expect(describeError(null)).toBeNull()
    expect(describeError('oops')).toBeNull()
    expect(describeError({})).toBeNull()
  })
})
