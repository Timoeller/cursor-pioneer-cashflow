import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminPanel } from '../components/AdminPanel'
import { AuthBar, UserMenu } from '../components/AuthBar'
import { BalanceChart } from '../components/BalanceChart'
import { CostBreakdown } from '../components/CostBreakdown'
import { CostsTable } from '../components/CostsTable'
import { EmployeesTable } from '../components/EmployeesTable'
import { FounderCashTable } from '../components/FounderCashTable'
import { ErrorScreen, LoadingScreen, PendingScreen, SignInScreen } from '../components/Gate'
import { GrantSection } from '../components/GrantSection'
import { MonthlyTable } from '../components/MonthlyTable'
import { RevenueTable } from '../components/RevenueTable'
import { SettingsPanel } from '../components/SettingsPanel'
import { SummaryStats } from '../components/SummaryStats'
import { createInitialState } from '../data/initialState'
import { computeCashflow, summarize } from '../model/cashflow'
import type { CloudSync } from '../storage/useCloudSync'

function html(node: ReactElement): string {
  return renderToStaticMarkup(node)
}

const cloud = {
  scenarios: [{ id: 's1', name: 'Basisszenario', updatedAt: 0 }],
  activeId: 's1',
  status: 'saved',
  error: 'offline',
  legacyCount: 2,
  moveLegacyToTeam: () => undefined,
  open: () => undefined,
  create: () => undefined,
  rename: () => undefined,
  remove: () => undefined,
} as unknown as CloudSync

describe('rendered German interface', () => {
  const state = createInitialState()
  state.settings.foundingMonth = '2027-01'
  const rows = computeCashflow(state)

  it('renders sign-in, waiting and error screens in German', () => {
    expect(html(createElement(LoadingScreen))).toContain('Wird geladen…')
    expect(html(createElement(SignInScreen))).toContain('Mit Google anmelden')
    const user = { email: 'ada@example.com', photoURL: null, displayName: 'Ada' }
    expect(html(createElement(PendingScreen, { user: user as never }))).toContain('Warten auf Freigabe')
    expect(html(createElement(ErrorScreen, { user: user as never, error: 'Netzwerk' }))).toContain('Etwas ist schiefgelaufen')
    expect(html(createElement(UserMenu, { user: user as never }))).toContain('Abmelden')
  })

  it('renders the planner controls in German', () => {
    const bar = html(createElement(AuthBar, { cloud, state, teamName: 'Pioneer', onImport: () => undefined }))
    expect(bar).toContain('JSON exportieren')
    expect(bar).toContain('JSON importieren')
    expect(bar).toContain('Duplizieren')
    expect(bar).toContain('Zu Pioneer verschieben')
    expect(bar).toContain('2 Szenarien')
    expect(bar).toContain('Cloud-Fehler')

    const costs = html(createElement(CostsTable, { costs: state.costs, currency: 'EUR', onChange: () => undefined }))
    expect(costs).toContain('Kosten hinzufügen')
    expect(costs).toContain('monatlich')
    expect(costs).toContain('einmalig')
    expect(costs).not.toContain('Add cost')

    const people = html(
      createElement(EmployeesTable, {
        employees: state.employees,
        surchargePct: 20,
        fundingRatePct: 80,
        additionalCostPct: 40,
        currency: 'EUR',
        onChange: () => undefined,
      }),
    )
    expect(people).toContain('Person hinzufügen')
    expect(people).toContain('Förderfähig %')

    const revenue = html(createElement(RevenueTable, { revenue: [], settings: state.settings, onChange: () => undefined }))
    expect(revenue).toContain('Noch kein Kundenumsatz.')
    expect(revenue).toContain('Umsatz hinzufügen')

    const founders = html(createElement(FounderCashTable, { founderCash: state.founderCash, settings: state.settings, onChange: () => undefined }))
    expect(founders).toContain('Einzahlung hinzufügen')
    expect(founders).toContain('Gründer 1')

    const grant = html(createElement(GrantSection, { state, onFundingChange: () => undefined, onTranchesChange: () => undefined }))
    expect(grant).toContain('Förderbetrag')
    expect(grant).toContain('In Tranchen')
    expect(grant).not.toContain('Grant amount')

    const settings = html(createElement(SettingsPanel, { settings: state.settings, onChange: () => undefined }))
    expect(settings).toContain('Planungshorizont (Monate)')
    expect(settings).toContain('Währung')

    const summary = html(createElement(SummaryStats, { summary: summarize(state, rows), settings: state.settings }))
    expect(summary).toContain('Reichweite')
    expect(summary).toContain('Gesamtkosten')
    expect(summary).toContain('Juli 27')
    expect(summary).toContain('Dez. 29')

    const monthly = html(createElement(MonthlyTable, { rows, state }))
    expect(monthly).toContain('Monatlicher Cashflow')
    expect(monthly).toContain('CSV exportieren')
    expect(monthly).toContain('Schlussbestand')
    expect(monthly).toContain('Jahr 1')

    const chart = html(createElement(BalanceChart, { rows, settings: state.settings }))
    expect(chart).toContain('Kassenstand')
    expect(chart).toContain('Schlussbestand je Monat')

    const breakdown = html(createElement(CostBreakdown, { rows, state }))
    expect(breakdown).toContain('Wohin das Geld fließt')
    expect(breakdown).toContain('Personal')

    const admin = html(createElement(AdminPanel, { currentUid: 'me' }))
    expect(admin).toContain('Nutzer')
    expect(admin).toContain('Neues Team')
    expect(admin).toContain('Jedes Team hat eigene Szenarien.')
  })
})
