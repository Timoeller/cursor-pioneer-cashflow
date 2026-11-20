import type { User } from 'firebase/auth'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { markerWidget } from './marker'
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
import { PLAN_TABS } from './ui/de'
import { useAccess } from './useAccess'

type Tab = (typeof PLAN_TABS)[number]['id']
type View = 'plan' | 'admin'

function Brand() {
  return (
    <div className="brand">
      <div className="logo" aria-hidden="true">₵</div>
      <div>
        <h1>Pioneer Cashflow</h1>
        <p className="muted small">Kosten, Umsatz, Förderung und Gründergeld, Monat für Monat</p>
      </div>
    </div>
  )
}

function MarkerWidget({ user }: { user: User | null }) {
  useEffect(() => {
    let cancelled = false
    markerWidget
      .then((widget) => {
        if (cancelled) return
        if (user?.email) widget.setReporter({ email: user.email, fullName: user.displayName ?? '' })
        else widget.clearReporter()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user])
  return null
}

export default function App() {
  const access = useAccess()
  const [view, setView] = useState<View>('plan')
  const reporter = access.status === 'loading' || access.status === 'signed-out' ? null : access.user

  let content: ReactNode
  if (access.status === 'loading') content = <LoadingScreen />
  else if (access.status === 'signed-out') content = <SignInScreen />
  else if (access.status === 'pending') content = <PendingScreen user={access.user} />
  else if (access.status === 'error') content = <ErrorScreen user={access.user} error={access.error} />
  else content = <PlannerShell access={access} view={view} setView={setView} />

  return (
    <>
      <MarkerWidget user={reporter} />
      {content}
    </>
  )
}

function PlannerShell({
  access,
  view,
  setView,
}: {
  access: Extract<ReturnType<typeof useAccess>, { status: 'ready' }>
  view: View
  setView: (view: View) => void
}) {
  const { user, isAdmin, team } = access
  const shownView: View = isAdmin && (view === 'admin' || !team) ? 'admin' : 'plan'

  return (
    <div className="app">
      {isAdmin && (
        <nav className="view-tabs" aria-label="Bereiche">
          <button type="button" className={shownView === 'plan' ? 'active' : ''} disabled={!team} onClick={() => setView('plan')}>
            Cashflow
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
          {!team && <div className="notice warn">Du bist noch in keinem Team. Weise dir unten ein Team zu, um den Cashflow-Planer zu nutzen.</div>}
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
              {PLAN_TABS.map((t) => (
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
        !cloud.error && <p className="muted">Szenarien werden geladen…</p>
      )}

      <footer className="footer muted small">Monate werden ab der Gründung gezählt (Monat 1). Szenarien sind für alle in {team.name} sichtbar.</footer>
    </div>
  )
}
