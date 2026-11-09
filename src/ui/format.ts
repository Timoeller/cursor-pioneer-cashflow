const formatters = new Map<string, Intl.NumberFormat>()

export function money(value: number, currency = 'EUR', compact = false): string {
  const key = `${currency}|${compact}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? 'compact' : 'standard',
    })
    formatters.set(key, f)
  }
  return f.format(Math.abs(value) < 0.5 ? 0 : value)
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)} %`
}

/** "M5" or, when a founding month (YYYY-MM) is set, "M5 · May 27". */
export function monthLabel(month: number, foundingMonth: string, short = false): string {
  const match = /^(\d{4})-(\d{2})$/.exec(foundingMonth)
  if (!match) return `M${month}`
  const d = new Date(Number(match[1]), Number(match[2]) - 1 + month - 1, 1)
  const cal = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  return short ? cal : `M${month} · ${cal}`
}
