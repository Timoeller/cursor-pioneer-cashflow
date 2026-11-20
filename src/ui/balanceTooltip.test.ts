import { describe, expect, it } from 'vitest'
import { balanceTooltipText } from './balanceTooltip'
import { CHART_SERIES } from './de'
import { money } from './format'

describe('balanceTooltipText', () => {
  it('shows a minus when the closing balance is below zero', () => {
    const text = balanceTooltipText(-12_500, CHART_SERIES.balance, 'EUR')
    expect(text).toBe(money(-12_500, 'EUR'))
    expect(text).toMatch(/[-−]/)
  })

  it('formats a positive or zero balance without a minus', () => {
    expect(balanceTooltipText(12_500, CHART_SERIES.balance, 'EUR')).toBe(money(12_500, 'EUR'))
    expect(balanceTooltipText(0, CHART_SERIES.balance, 'EUR')).toBe(money(0, 'EUR'))
    expect(balanceTooltipText(12_500, CHART_SERIES.balance, 'EUR')).not.toMatch(/[-−]/)
  })

  it('keeps stacked inflows and costs as positive amounts', () => {
    expect(balanceTooltipText(-4_200, CHART_SERIES.costs, 'EUR')).toBe(money(4_200, 'EUR'))
    expect(balanceTooltipText(25_000, CHART_SERIES.founder, 'EUR')).toBe(money(25_000, 'EUR'))
    expect(balanceTooltipText(8_000, CHART_SERIES.revenue, 'EUR')).toBe(money(8_000, 'EUR'))
    expect(balanceTooltipText(15_000, CHART_SERIES.grant, 'EUR')).toBe(money(15_000, 'EUR'))
  })
})
