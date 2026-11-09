import { useCallback, useMemo, useState } from 'react'
import { AuthBar } from './components/AuthBar'
import { BalanceChart } from './components/BalanceChart'
import { CostBreakdown } from './components/CostBreakdown'
import { CostsTable } from './components/CostsTable'
import { EmployeesTable } from './components/EmployeesTable'
import { FounderCashTable } from './components/FounderCashTable'
import { GrantSection } from './components/GrantSection'
import { MonthlyTable } from './components/MonthlyTable'
import { SettingsPanel } from './components/SettingsPanel'
import { SummaryStats } from './components/SummaryStats'
import { createInitialState } from './data/initialState'
import { computeCashflow, personnelFundingRatePct, summarize } from './model/cashflow'
import type { PlanState } from './model/types'
import { loadLocal, saveLocal } from './storage/local'
import { useCloudSync } from './storage/useCloudSync'

type Tab = 'costs' | 'employees' | 'grant' | 'founders' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'costs', label: 'Costs' },
  { id: 'employees', label: 'Employees' },
  { id: 'grant', label: 'Grant' },
  { id: 'founders', label: 'Founder cash' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [state, setStateRaw] = useState<PlanState>(() => loadLocal() ?? createInitialState())
  const [tab, setTab] = useState<Tab>('costs')

  const setState = useCallback((next: PlanState) => {
    setStateRaw(next)
    saveLocal(next)
  }, [])
  const patch = <K extends keyof PlanState>(key: K) => (value: PlanState[K]) => setState({ ...state, [key]: value })

  const cloud = useCloudSync({ state, replaceState: setState })
  const rows = useMemo(() => computeCashflow(state), [state])
  const summary = useMemo(() => summarize(state, rows), [state, rows])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true">₵</div>
          <div>
            <h1>Pioneer Cash Flow</h1>
            <p className="muted small">Costs, team, grant and founder cash, month by month</p>
          </div>
        </div>
        <AuthBar cloud={cloud} state={state} onImport={setState} />
      </header>

      <main>
        <SummaryStats summary={summary} settings={state.settings} />
        <div className="grid-chart">
          <BalanceChart rows={rows} settings={state.settings} />
          <CostBreakdown rows={rows} state={state} />
        </div>

        <section className="inputs">
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          {tab === 'costs' && <CostsTable costs={state.costs} currency={state.settings.currency} onChange={patch('costs')} />}
          {tab === 'employees' && (
            <EmployeesTable employees={state.employees} surchargePct={state.settings.employerSurchargePct} fundingRatePct={personnelFundingRatePct(state)} currency={state.settings.currency} onChange={patch('employees')} />
          )}
          {tab === 'grant' && <GrantSection state={state} onComponentsChange={patch('grantComponents')} onTranchesChange={patch('tranches')} onPeriodChange={patch('fundingPeriod')} />}
          {tab === 'founders' && <FounderCashTable founderCash={state.founderCash} settings={state.settings} onChange={patch('founderCash')} />}
          {tab === 'settings' && <SettingsPanel settings={state.settings} onChange={patch('settings')} />}
        </section>

        <MonthlyTable rows={rows} state={state} />
      </main>

      <footer className="footer muted small">
        Months are counted from founding (month 1). All calculations run in your browser.
      </footer>
    </div>
  )
}
