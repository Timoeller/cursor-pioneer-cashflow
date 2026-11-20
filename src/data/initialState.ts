import type { CostItem, Employee, PlanState } from '../model/types'

/**
 * Cost lines from costs_pioneer.xlsx (sheet "Spend"), excluding founder salaries.
 * The old numeric factors are included in the amount (software was 200×3, travel 1000×3).
 */
export const initialCosts: CostItem[] = [
  { id: 'c-founding', name: 'founding costs (gmbh, notary)', monthlyAmount: 1000, recurring: false, perEmployee: false, comment: '' },
  { id: 'c-legal', name: 'legal funding', monthlyAmount: 7500, recurring: false, perEmployee: false, comment: 'Verantwortungseigentum Gesellschaftsvertrag (2.5k) + Mitarbeiterbeteiligung (5k)' },
  { id: 'c-tax', name: 'steuerberater', monthlyAmount: 200, recurring: true, perEmployee: false, comment: '' },
  { id: 'c-office', name: 'office', monthlyAmount: 1250, recurring: true, perEmployee: false, comment: 'rent' },
  { id: 'c-office-budget', name: 'office budget', monthlyAmount: 500, recurring: false, perEmployee: false, comment: 'hardware and office supplies' },
  { id: 'c-software', name: 'software', monthlyAmount: 600, recurring: true, perEmployee: false, comment: 'subscriptions etc. (Chatgpt/Perplexity, Slack, Gdrive, Notion, MS 365)' },
  { id: 'c-llm', name: 'llm costs/cloud compute', monthlyAmount: 500, recurring: true, perEmployee: false, comment: 'AI agents working in app' },
  { id: 'c-coding', name: 'coding agents', monthlyAmount: 2000, recurring: true, perEmployee: false, comment: '' },
  { id: 'c-security', name: 'IT security', monthlyAmount: 500, recurring: true, perEmployee: false, comment: 'Tools that make our products and infrasturture safer and compliant, e.g. Vanta' },
  { id: 'c-marketing', name: 'marketing', monthlyAmount: 1000, recurring: true, perEmployee: false, comment: 'events, collateral, hubspot, freelancer, design, Bewirtung von potentiellen Angestellten oder Dinner für Experten/Kunden-Runde' },
  { id: 'c-travel', name: 'travels/offsite', monthlyAmount: 3000, recurring: true, perEmployee: false, comment: 'HH / B setup and related costs, travels to clients and events' },
  { id: 'c-hr', name: 'HR tooling', monthlyAmount: 200, recurring: true, perEmployee: false, comment: 'TBD, tools like spendesk, personio etc' },
  { id: 'c-insurance', name: 'insurances', monthlyAmount: 35, recurring: true, perEmployee: false, comment: 'Berufshaftpflicht, Betriebshaftpflicht' },
].map((c) => ({ ...c, startMonth: 1, endMonth: null }))

/** "founder salaries" row: 8,000 / month incl. 20% employer share, x3 founders. */
const founders: Employee[] = [1, 2, 3].map((n) => ({
  id: `e-founder-${n}`,
  name: `Gründer ${n}`,
  monthlySalary: 6666.67,
  startMonth: 1,
  endMonth: null,
  fundingEligiblePct: 80,
}))

export function createInitialState(): PlanState {
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
    funding: { ratePct: 80, additionalCostPct: 40, amount: 500000, payMonthly: true },
    tranches: [
      { id: 't-1', month: 4 },
      { id: 't-2', month: 12 },
      { id: 't-3', month: 20 },
    ],
    founderCash: [1, 2, 3].map((n) => ({ id: `f-${n}`, founder: `Gründer ${n}`, month: 1, amount: 25000 })),
    revenue: [],
  }
}
