import { describe, expect, it } from 'vitest'
import { monthLabel } from './format'

describe('monthLabel', () => {
  it('uses a German month name when a founding month is set', () => {
    expect(monthLabel(5, '2027-01')).toBe('M5 · Mai 27')
    expect(monthLabel(3, '2027-01')).toBe('M3 · März 27')
    expect(monthLabel(5, '2027-01', true)).toBe('Mai 27')
  })

  it('keeps the plain month number when no founding month is set', () => {
    expect(monthLabel(5, '')).toBe('M5')
  })
})
