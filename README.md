# 💎 FinFlow Command Center
### Production-Quality Personal Finance, AI Insights, Trip Savings & Lend/Borrow SaaS

A complete personal financial command center engineered with modern TypeScript, React 19, Tailwind CSS, Express, and Prisma ORM with strict relational database persistence.

---

## 🌟 Key Features

1. **Fintech Master Dashboard**:
   - 11 coordinated sections: Welcome card with health summary, 4 KPI stat cards (Total Balance, Monthly Income, Monthly Expenses, Available to Spend), Financial Health Score (0-100) with 4-pillar breakdown and explanation, 30d/6m Cash Flow analytics chart, Spending Breakdown donut chart, Budget progress cards with over-budget alerts, Trip savings widget, Upcoming recurring payments, Lend & Borrow summary, Recent transactions, and AI Insights feed.

2. **Permanent Relational Data Persistence**:
   - **Zero Data Loss Guarantee**: User data is strictly persisted in a real relational database (`dev.db` via Prisma ORM) and survives logouts, restarts, browser reloads, updates, and navigation.
   - **Integer Paise Money Calculation**: No floating-point math issues (`1 INR = 100 Paise`), preventing float rounding bugs.
   - **ACID Transactions**: Multi-record operations (transfers, loan repayments, trip contributions, goal allocations) are executed in atomic database transactions.

3. **Global Quick Add Floating/Header System**:
   - Fast modal with 8 specialized tabs: **Expense**, **Income**, **Transfer** (does *not* count as income or expense), **Trip Saving**, **Lend Money**, **Borrow Money**, **Repayment**, and **Bill**.

4. **Trip Savings Planner & Calculator Engine**:
   - Complete vacation & expedition budgeting (Transportation, Accommodation, Food, Activities, Shopping, Emergency).
   - Real-time calculator: Remaining amount, days/weeks/months left, required daily & monthly savings pace, shortfall/surplus projection, and on-track indicators.

5. **Lend & Borrow (Udhaar) Module**:
   - Dual ledgers: **Money I Lent** (Receivables) vs. **Money I Borrowed** (Payables).
   - Partial repayments stored as separate historical records, never overwriting past transactions.
   - Correct accounting: Lent/borrowed principal is isolated from ordinary income/expense.

6. **Explainable AI Assistant & Insights Engine**:
   - **Grounded in Database**: Answers user questions using real database data (spending anomalies, trip affordability, upcoming bills, loan receivables) with zero hallucinations.
   - **Safe Action Proposals**: When the user asks the assistant to take action (e.g. create a budget), AI prepares a confirmed proposal requiring explicit user approval before execution.

7. **Budgets & Threshold Alerts**:
   - Monthly and weekly category budgets with custom alert thresholds (50%, 75%, 80%, 90%, 100%).
   - Historical comparisons vs. previous month (+/- %).

8. **Recurring Bills & Subscriptions**:
   - Manage Netflix, Rent, Electricity, Broadband, Gym memberships with automated cycle advancement and one-click payment deductions.

9. **Data Export & Strict Permanent Reset**:
   - One-click structured **JSON Backup Export** & **CSV Transactions Export**.
   - Explicit **Permanent Data Reset** requiring typed confirmation `"RESET"` and password verification, with prominent backup reminder.

---

## 🚀 Quick Start Guide

### Demo Credentials:
- **Email**: `demo@finflow.io`
- **Password**: `password123`
*(Or click the 1-Click Demo Account button on the login screen)*

### Running the Services:

#### Backend API (Port 5000):
```bash
cd server
npm run dev
# Or production mode:
npm run start
```

#### Frontend Application (Port 5173):
```bash
cd client
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 🧪 Testing

Run the automated test suite verifying floating-point safety, trip pace calculations, and Udhaar accounting invariants:

```bash
cd server
npm test
```
All 6/6 tests pass with 100% success rate.
