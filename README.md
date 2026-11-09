# Pioneer Cash Flow

A simple cash flow planner for an early-stage startup. It runs entirely in the browser and is hosted on GitHub Pages:

**https://timoeller.github.io/cursor-pioneer-cashflow/**

## What it does

- **Costs**: starts with the cost lines from `costs_pioneer.xlsx`. Every line is editable: amount, monthly or one-off, multiplier, start and end month, comment. You can add or remove lines.
- **Employees**: add as many people as you like, each with a gross monthly salary, a start month (month 1 = founding month) and an individual funding-eligible percentage. The employer surcharge (default 20 %) is a global setting. The three founders are pre-filled (8,000 € per month each incl. employer share, as in the spreadsheet).
- **Grant funding**: several components, each with the amount the funding rate applies to and the rate. A helper computes the funding-eligible personnel cost for a month range. The money arrives in tranches (payout month and amount); the tool warns when the tranches don't add up to the grant.
- **Founder cash**: money the founders put into the company, per founder and month.
- **Results**: runway, lowest balance, cash still needed, burn rate, grant share of costs and more; a balance chart; a cost breakdown; a month-by-month table with yearly subtotals and CSV export.

The grant, tranche and founder cash values that come pre-filled are examples; replace them with your own.

## Saving your data

- **Without signing in**, everything is saved in your browser (localStorage). Use *Export JSON* / *Import JSON* to back up or share a scenario.
- **With Google sign-in**, data is saved to your account (Firebase Firestore) and loads on any device. You can keep several named scenarios (e.g. "Base case", "Grant delayed"); changes save automatically about a second after you stop typing. The first time you sign in, the data from your browser becomes your first scenario.

Sign-in only appears once Firebase is configured (see below).

## One-time setup

### 1. GitHub Pages

In the repository go to **Settings > Pages** and set **Source** to **GitHub Actions**. Every push to `main` then builds, tests and deploys the site (`.github/workflows/deploy.yml`).

### 2. Firebase (for Google sign-in)

1. Go to the [Firebase console](https://console.firebase.google.com/), create a project (the free Spark plan is enough) and add a **Web app**. Note the config values `apiKey`, `authDomain`, `projectId` and `appId`.
2. **Authentication > Sign-in method**: enable **Google**.
3. **Authentication > Settings > Authorized domains**: add `timoeller.github.io`.
4. **Firestore Database**: create a database (production mode), then open the **Rules** tab and paste the contents of [`firestore.rules`](firestore.rules). The rules make sure every user can only read and write their own data.
5. In GitHub go to **Settings > Secrets and variables > Actions > Variables** and add these repository variables:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

   These values are not secret (they are shipped to every browser); the Firestore rules are what protect the data.
6. Re-run the deploy workflow (Actions > Deploy to GitHub Pages > Run workflow) or push to `main`.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173/cursor-pioneer-cashflow/
npm test           # unit tests for the cash flow calculation and saving logic
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

To use your real Firebase project locally, copy `.env.example` to `.env.local` and fill in the values.

## How the numbers are calculated

- Months are counted from founding: month 1 is the founding month. Setting a founding month in *Settings* adds calendar labels.
- Recurring cost per month = amount x multiplier, from its start month to its end month (empty = forever). One-off costs are booked once, in their start month.
- Personnel cost per month = gross salary x (1 + employer surcharge). The funding-eligible part = personnel cost x the employee's funding-eligible %.
- Grant = sum over components of amount x funding rate. Cash arrives when the tranches are paid out.
- Closing balance = opening balance + founder cash + grant tranches - costs - personnel.

Note: the yearly total cell in the original spreadsheet (`SUM(F2:F13)`) leaves out HR tooling and insurances. The correct total is 408,420 € per year, which is what the tool shows for year 1.
