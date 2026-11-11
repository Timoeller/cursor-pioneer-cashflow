# Pioneer Cash Flow

A simple cash flow planner for an early-stage startup. It runs in the browser, is hosted on GitHub Pages and stores its data in Firebase:

**https://timoeller.github.io/cursor-pioneer-cashflow/**

## What it does

- **Costs**: starts with the cost lines from `costs_pioneer.xlsx`. Every line is editable: amount, monthly or one-off, multiplier, start and end month, comment. You can add or remove lines.
- **Employees**: add as many people as you like, each with a gross monthly salary, a start month (month 1 = founding month) and an individual funding-eligible percentage. The employer surcharge (default 20 %) is a global setting. The three founders are pre-filled (8,000 € per month each incl. employer share, as in the spreadsheet).
- **Revenue**: customer payments, each either monthly (with a start and end month) or one-time.
- **Grant funding**: a fixed grant amount, a funding rate (default 80 %) and an additional-cost rate (default 40 %). Each month the grant pays the funding rate on the share of each employee's time that can be funded, then additional costs up to 40 % of that fundable cost, until the grant amount is used up. Someone who costs 100 and is fundable 50 % of the time is covered for 40 while money remains. By default the money arrives in the month it covers the cost. You can instead release it in tranches: you only set the month, and each tranche pays the funded salaries and additional costs that have built up since the previous one.
- **Founder cash**: money the founders put into the company, per founder and month.
- **Results**: when cash runs out, how much the founders still have to put in, the grant coverage and the burn rate; a balance chart; a cost breakdown; a month-by-month table with yearly subtotals and CSV export.

The grant, tranche and founder cash values that come pre-filled are examples; replace them with your own.

## Access, teams and saving

- **Sign-in is required.** Visitors only see a *Sign in with Google* page. After signing in for the first time, an account waits for approval and still sees no data.
- **Admins** get an *Admin* tab. It lists everyone who has signed in (people waiting for approval first). Choosing a team for someone gives them access; *Remove access* takes it away again. Admins can create and rename teams and make other users admins. `moeller.timo@gmail.com` is always an admin (set in `src/firebase.ts` and `firestore.rules`).
- **Teams share data.** Everyone in a team sees and edits the same named scenarios (e.g. "Base case", "Grant delayed"). Changes save automatically about a second after you stop typing and show up for teammates without reloading. If two people edit the same scenario at the same moment, the last save wins.
- Scenarios saved per person before teams existed are offered once with a *Move to <team>* button.
- Use *Export JSON* / *Import JSON* to back up or copy a scenario.

## One-time setup

### 1. GitHub Pages

In the repository go to **Settings > Pages** and set **Source** to **GitHub Actions**. Every push to `main` then builds, tests and deploys the site (`.github/workflows/deploy.yml`).

### 2. Firebase (Google sign-in and Firestore)

The app uses the Firebase project `pioneer-cashflow` (web app `1:706818236179:web:782aa8e32151f71788c4e6`). Its public web config is in [`src/firebase.ts`](src/firebase.ts), and [`firebase.json`](firebase.json) / [`.firebaserc`](.firebaserc) describe the backend:

- **Authentication**: Google sign-in is enabled. Authorized domains include `timoeller.github.io` and `localhost`.
- **Firestore**: the default database (Standard edition) is in `europe-west10` (Berlin) with delete protection on. [`firestore.rules`](firestore.rules) enforces the access model above:
  - `users/{uid}`: profile each user writes when they sign in; readable by them and admins.
  - `members/{uid}`: team and role (`member` or `admin`); only admins can write it, so nobody can approve themselves.
  - `teams/{teamId}` and `teams/{teamId}/scenarios/...`: only members of that team can read and write the scenarios. Every write is checked for shape and size.

After changing the rules or the auth config, deploy them with the Firebase CLI:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --only auth,firestore
```

Authorized domains are not part of `firebase.json`; add new ones in the Firebase console under **Authentication > Settings > Authorized domains**.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173/cursor-pioneer-cashflow/
npm test           # unit tests for the cash flow calculation and saving logic
npm run test:rules # Firestore security rules tests against the emulator (needs Java)
npm run lint
npm run build
```

To try sign-in locally without a real Firebase project, start the Firebase emulators (needs Java) and point the app at them:

```bash
npm run emulators
cat > .env.local <<'EOF'
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-cashflow.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-cashflow
VITE_FIREBASE_APP_ID=demo-app
VITE_FIREBASE_USE_EMULATOR=true
EOF
npm run dev
```

`npm run dev` uses the real `pioneer-cashflow` project by default. Variables in `.env.local` (see `.env.example`) override the built-in config.

## How the numbers are calculated

- Months are counted from founding: month 1 is the founding month. Setting a founding month in *Settings* adds calendar labels.
- Recurring cost per month = amount x multiplier, from its start month to its end month (empty = forever). One-off costs are booked once, in their start month.
- Personnel cost per month = gross salary x (1 + employer surcharge). Fundable personnel = that cost x the employee's funding-eligible %.
- Each month the grant pays fundable personnel x funding rate, then additional costs up to fundable personnel x the additional-cost rate, capped by the other costs that month. Salaries are paid first. This continues until the fixed grant amount is used up; after that the founders finance every cost.
- 1,000 of personnel funding at 80 % belongs to 1,250 of cost, so the founders put in 250. At 50 % fundable time, additional costs can be 40 % x 50 % = 20 % of the person's cost, and the funding rate is not applied to them.
- Grant cash arrives monthly, equal to what it covers that month, or on the tranche dates if you choose tranches. A tranche's amount is the funded personnel and additional costs since the previous tranche, through its release month. Covered costs after the last tranche are not paid out until you add another one.
- Revenue is monthly between its start and end month, or once in its start month.
- Closing balance = opening balance + founder cash + revenue + grant - costs.

Note: the yearly total cell in the original spreadsheet (`SUM(F2:F13)`) leaves out HR tooling and insurances. The correct total is 408,420 € per year, which is what the tool shows for year 1.
