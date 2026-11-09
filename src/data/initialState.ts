import { fundingBreakdown } from '../model/cashflow'
import type { CostItem, Employee, PlanState } from '../model/types'

/** Cost lines from costs_pioneer.xlsx (sheet "Spend"), excluding founder salaries. */
export const initialCosts: CostItem[] = [
  { id: 'c-founding', name: 'founding costs (gmbh, notary)', monthlyAmount: 1000, recurring: false, multiplier: 1, comment: '' },
  { id: 'c-legal', name: 'legal funding', monthlyAmount: 7500, recurring: false, multiplier: 1, comment: 'Verantwortungseigentum Gesellschaftsvertrag (2.5k) + Mitarbeiterbeteiligung (5k)' },
  { id: 'c-tax', name: 'steuerberater', monthlyAmount: 200, recurring: true, multiplier: 1, comment: '' },
  { id: 'c-office', name: 'office', monthlyAmount: 1250, recurring: true, multiplier: 1, comment: 'rent' },
  { id: 'c-office-budget', name: 'office budget', monthlyAmount: 500, recurring: false, multiplier: 1, comment: 'hardware and office supplies' },
  { id: 'c-software', name: 'software', monthlyAmount: 200, recurring: true, multiplier: 3, comment: 'subscriptions etc. (Chatgpt/Perplexity, Slack, Gdrive, Notion, MS 365)' },
  { id: 'c-llm', name: 'llm costs/cloud compute', monthlyAmount: 500, recurring: true, multiplier: 1, comment: 'AI agents working in app' },
  { id: 'c-coding', name: 'coding agents', monthlyAmount: 2000, recurring: true, multiplier: 1, comment: '' },
  { id: 'c-security', name: 'IT security', monthlyAmount: 500, recurring: true, multiplier: 1, comment: 'Tools that make our products and infrasturture safer and compliant, e.g. Vanta' },
  { id: 'c-marketing', name: 'marketing', monthlyAmount: 1000, recurring: true, multiplier: 1, comment: 'events, collateral, hubspot, freelancer, design, Bewirtung von potentiellen Angestellten oder Dinner für Experten/Kunden-Runde' },
  { id: 'c-travel', name: 'travels/offsite', monthlyAmount: 1000, recurring: true, multiplier: 3, comment: 'HH / B setup and related costs, travels to clients and events' },
  { id: 'c-hr', name: 'HR tooling', monthlyAmount: 200, recurring: true, multiplier: 1, comment: 'TBD, tools like spendesk, personio etc' },
  { id: 'c-insurance', name: 'insurances', monthlyAmount: 35, recurring: true, multiplier: 1, comment: 'Berufshaftpflicht, Betriebshaftpflicht' },
].map((c) => ({ ...c, startMonth: 1, endMonth: null }))

/** "founder salaries" row: 8,000 / month incl. 20% employer share, x3 founders. */
const founders: Employee[] = [1, 2, 3].map((n) => ({
  id: `e-founder-${n}`,
  name: `Founder ${n}`,
  monthlySalary: 6666.67,
  startMonth: 1,
  endMonth: null,
  fundingEligiblePct: 80,
}))

export function createInitialState(): PlanState {
  const state = baseState()
  const f = fundingBreakdown(state)
  const third = Math.round(f.grant / 3)
  state.tranches = [
    { id: 't-1', kind: 'grant', month: 4, amount: third },
    { id: 't-2', kind: 'grant', month: 12, amount: third },
    { id: 't-3', kind: 'grant', month: 20, amount: Math.round(f.grant) - 2 * third },
    { id: 't-4', kind: 'loan', month: 4, amount: Math.round(f.loan) },
  ]
  return state
}

function baseState(): PlanState {
  return {
    version: 1,
    settings: {
      horizonMonths: 36,
      foundingMonth: '',
      employerSurchargePct: 20,
      startingCash: 0,
      currency: 'EUR',
    },
    costs: initialCosts.map((c) => ({ ...c })),
    employees: founders.map((e) => ({ ...e })),
    fundingPeriod: { fromMonth: 1, toMonth: 24 },
    grantComponents: [
      { id: 'g-personnel', name: 'Personnel costs', basis: 'personnel', amount: 0, ratePct: 80, grantSharePct: 100 },
      { id: 'g-material', name: 'Investments & material (example)', basis: 'manual', amount: 50000, ratePct: 80, grantSharePct: 0 },
    ],
    tranches: [],
    founderCash: [1, 2, 3].map((n) => ({ id: `f-${n}`, founder: `Founder ${n}`, month: 1, amount: 25000 })),
  }
}
