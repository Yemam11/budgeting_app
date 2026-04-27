# WealthWise

A privacy-first personal finance desktop application built with React, Electron, and SQLite. All data lives locally on your machine — no cloud, no accounts, no subscriptions.

## Running Locally (Development)

```bash
cd app
npm install
npm run dev
```

This starts the Express backend (port 3001) and the Vite dev server (port 5173) concurrently. Open `http://localhost:5173` in your browser, or just launch the Electron window.

---

## Features

### Transaction Management
- Import bank statements from **American Express** (.xls/.xlsx), **BMO** (.csv), and **Scotiabank** (.csv)
- Automatic duplicate detection across imports using a hash of bank + date + amount + description
- Smart merchant normalization strips POS prefixes, province codes, and trailing noise before matching rules
- Full transaction list with filtering by type (spend / income / transfer / CC payment), date range, and free-text search
- Inline note editing, type overrides, hide/delete per transaction, and manual transaction entry

### Smart Categorization
- **Seed rules** — 14 built-in keyword patterns map common merchants to categories on import (e.g. "starbucks" → Café, "amazon" → Online Purchase)
- **Merchant rules** — when you recategorize a transaction you can apply the change to all transactions from the same merchant and save a rule for future imports
- **Confidence scoring** — every category assignment carries a 0–1 confidence score; transactions below your threshold are flagged for review in a dedicated filter tab
- **Undo** — recategorizing with merchant propagation shows an undo banner for 5 seconds so you can revert accidental bulk changes

### Budgeting
- Set monthly spending limits per category
- Real-time pace tracking compares your spend-to-date against where you *should* be given the current day of month
- Visual status indicators: on track, at risk (within 20%), or over budget

### Expense Splitting
- Split any spend transaction evenly across N people or with custom per-person amounts
- Automatically creates outstanding entries for each person who owes you

### Outstanding Balances
- Track who owes you money and for which transaction
- Smart settlement matching: when an income transaction arrives from the same person within 45 days and within $2 of the outstanding amount it is auto-proposed as a settlement
- Manual settle option for cash repayments
- Contact book synced automatically from outstanding entries

### Analytics Dashboard
- **Donut chart** — top spending categories this month
- **Cashflow bars** — 12-week rolling income vs spend
- **Sankey diagram** — visualises income flowing into each spending category
- **Stacked bar chart** — 6-month category spend trend
- **Budget progress rings** — monthly budget utilisation per category
- Key metrics strip: total spend, income, top category, needs-review count, outstanding balance

### Data & Settings
- **Categories** — create, edit, reorder, archive, or delete spending and income categories with custom colours
- **Merchant rules** — view and delete learned categorisation rules
- **Confidence threshold** — adjust the score below which transactions are flagged for review (default 85%)
- **Backup** — export the entire database to JSON; restore from a backup file at any time
- **Wipe** — full database reset back to seed state

---

## Building the Desktop App

```bash
cd app
npm run build:win   # Windows NSIS installer → app/release/
npm run build:mac   # macOS DMG (universal) → app/release/
npm run build:all   # Both platforms
```

## Releasing

Push a version tag to trigger the GitHub Actions CI matrix (macOS x64 + arm64, Windows):

```bash
git tag v1.2.0
git push origin v1.2.0
```

Artifacts are published automatically as a GitHub release.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS, OKLch colour tokens, glass morphism |
| Desktop shell | Electron 41 |
| Backend | Express 4 (runs inside the Electron main process) |
| Database | SQLite (`node:sqlite`, synchronous API, WAL mode) |
| Charts | Custom SVG — no runtime chart library |
| CSV parsing | PapaParse |
| Excel parsing | SheetJS (xlsx) |
| IDs | nanoid |

## Supported Banks

| Bank | Format |
|---|---|
| American Express | .xls / .xlsx |
| BMO | .csv |
| Scotiabank | .csv |

---

## Privacy

All financial data is stored in a SQLite file on your local machine (`budget.db` inside the OS app-data directory). Nothing is transmitted anywhere. Backups are manual JSON exports that you control.
