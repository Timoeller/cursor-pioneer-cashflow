import type { User } from 'firebase/auth'
import { useMemo, useState } from 'react'
import { AdminPanel } from './components/AdminPanel'
import { AuthBar, UserMenu } from './components/AuthBar'
import { BalanceChart } from './components/BalanceChart'
import { CostBreakdown } from './components/CostBreakdown'
import { CostsTable } from './components/CostsTable'
import { EmployeesTable } from './components/EmployeesTable'
import { FounderCashTable } from './components/FounderCashTable'
import { ErrorScreen, LoadingScreen, PendingScreen, SignInScreen } from './components/Gate'
import { GrantSection } from './components/GrantSection'
import { MonthlyTable } from './components/MonthlyTable'
import { RevenueTable } from './components/RevenueTable'
import { SettingsPanel } from './components/SettingsPanel'
import { SummaryStats } from './components/SummaryStats'
import { createInitialState } from './data/initialState'
import { teamStore, type Team } from './firebase'
import { computeCashflow, summarize } from './model/cashflow'
import type { PlanState } from './model/types'
import { useCloudSync } from './storage/useCloudSync'
import { useAccess } from './useAccess'

type Tab = 'costs' | 'employees' | 'revenue' | 'grant' | 'founders' | 'settings'
type View = 'plan' | 'admin'

const TABS: { id: Tab; label: string }[] = [
  { id: 'costs', label: 'Costs' },
  { id: 'employees', label: 'Employees' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'grant', label: 'Grant' },
  { id: 'founders', label: 'Founder cash' },
  { id: 'settings', label: 'Settings' },
]

function Brand() {
  return (
    <div className="brand">
      <div className="logo" aria-hidden="true">₵</div>
      <div>
        <h1>Pioneer Cash Flow</h1>
        <p className="muted small">Costs, revenue, grant and founder cash, month by month</p>
      </div>
    </div>
  )
}

export default function App() {
  const access = useAccess()
  const [view, setView] = useState<View>('plan')

  if (access.status === 'loading') return <LoadingScreen />
  if (access.status === 'signed-out') return <SignInScreen />
  if (access.status === 'pending') return <PendingScreen user={access.user} />
  if (access.status === 'error') return <ErrorScreen user={access.user} error={access.error} />

  const { user, isAdmin, team } = access
  const shownView: View = isAdmin && (view === 'admin' || !team) ? 'admin' : 'plan'

  return (
    <div className="app">
      {isAdmin && (
        <nav className="view-tabs" aria-label="Sections">
          <button type="button" className={shownView === 'plan' ? 'active' : ''} disabled={!team} onClick={() => setView('plan')}>
            Cash flow
          </button>
          <button type="button" className={shownView === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
            Admin
          </button>
        </nav>
      )}

      {team && <Planner key={team.id} user={user} team={team} hidden={shownView !== 'plan'} />}

      {shownView === 'admin' && (
        <>
          <header className="topbar">
            <Brand />
            <div className="authbar">
              <UserMenu user={user} />
            </div>
          </header>
          {!team && <div className="notice warn">You are not in a team yet. Assign yourself to a team below to use the cash flow planner.</div>}
          <AdminPanel currentUid={user.uid} />
        </>
      )}
    </div>
  )
}

function Planner({ user, team, hidden }: { user: User; team: Team; hidden: boolean }) {
  const [state, setState] = useState<PlanState>(createInitialState)
  const [tab, setTab] = useState<Tab>('costs')
  const patch = <K extends keyof PlanState>(key: K) => (value: PlanState[K]) => setState({ ...state, [key]: value })

  const store = useMemo(() => teamStore(team.id), [team.id])
  const cloud = useCloudSync({ uid: user.uid, teamId: team.id, store, state, replaceState: setState })
  const rows = useMemo(() => computeCashflow(state), [state])
  const summary = useMemo(() => summarize(state, rows), [state, rows])

  return (
    <div hidden={hidden}>
      <header className="topbar">
        <Brand />
        <AuthBar cloud={cloud} state={state} teamName={team.name} onImport={setState} />
        <UserMenu user={user} />
      </header>

      {cloud.activeId ? (
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
              <EmployeesTable employees={state.employees} surchargePct={state.settings.employerSurchargePct} fundingRatePct={state.funding.ratePct} additionalCostPct={state.funding.additionalCostPct} currency={state.settings.currency} onChange={patch('employees')} />
            )}
            {tab === 'revenue' && <RevenueTable revenue={state.revenue} settings={state.settings} onChange={patch('revenue')} />}
            {tab === 'grant' && <GrantSection state={state} onFundingChange={patch('funding')} onTranchesChange={patch('tranches')} />}
            {tab === 'founders' && <FounderCashTable founderCash={state.founderCash} settings={state.settings} onChange={patch('founderCash')} />}
            {tab === 'settings' && <SettingsPanel settings={state.settings} onChange={patch('settings')} />}
          </section>

          <MonthlyTable rows={rows} state={state} />
        </main>
      ) : (
        !cloud.error && <p className="muted">Loading scenarios…</p>
      )}

      <footer className="footer muted small">Months are counted from founding (month 1). Scenarios are shared with everyone in {team.name}.</footer>
    </div>
  )
}
