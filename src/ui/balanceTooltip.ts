import { CHART_SERIES } from './de'
import { money } from './format'

/**
 * Text for one series in the cash-balance chart tooltip.
 * Inflows and costs are stored with a sign so the bars stack above and below zero;
 * those labels stay positive amounts. The balance series keeps its sign.
 */
export function balanceTooltipText(value: number, series: string, currency: string): string {
  const shown = series === CHART_SERIES.balance ? value : Math.abs(value)
  return money(shown, currency)
}
