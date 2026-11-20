/** German labels shared by more than one screen. */

export const DEFAULT_SCENARIO_NAME = 'Basisszenario'
export const UNTITLED_SCENARIO = 'Unbenannt'

/** Legend names on the cash-balance chart. The balance series keeps its sign in the tooltip. */
export const CHART_SERIES = {
  balance: 'Bestand',
  founder: 'Gründergeld',
  revenue: 'Umsatz',
  grant: 'Förderung',
  costs: 'Kosten',
} as const

export function deCount(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
