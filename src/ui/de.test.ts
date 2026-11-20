import { describe, expect, it } from 'vitest'
import { CHART_SERIES, DEFAULT_SCENARIO_NAME, PLAN_TABS, UNTITLED_SCENARIO, deCount } from './de'

describe('German copy helpers', () => {
  it('picks the singular or plural noun', () => {
    expect(deCount(1, 'Monat', 'Monate')).toBe('1 Monat')
    expect(deCount(36, 'Monat', 'Monate')).toBe('36 Monate')
    expect(deCount(1, 'Szenario', 'Szenarien')).toBe('1 Szenario')
  })

  it('names the default scenario and chart series in German', () => {
    expect(DEFAULT_SCENARIO_NAME).toBe('Basisszenario')
    expect(UNTITLED_SCENARIO).toBe('Unbenannt')
    expect(Object.values(CHART_SERIES)).toEqual(['Bestand', 'Gründergeld', 'Umsatz', 'Förderung', 'Kosten'])
    expect(PLAN_TABS.map((tab) => tab.label)).toEqual(['Kosten', 'Mitarbeitende', 'Umsatz', 'Förderung', 'Gründergeld', 'Einstellungen'])
  })
})
