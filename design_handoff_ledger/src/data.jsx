// Mock data modeled on the app's real schema
const CATEGORIES = [
  { id: 'groceries', name: 'Groceries', color: 'oklch(72% 0.14 155)', order: 10 },
  { id: 'gas', name: 'Gas', color: 'oklch(72% 0.15 45)', order: 20 },
  { id: 'transportation', name: 'Transportation', color: 'oklch(68% 0.14 40)', order: 25 },
  { id: 'bills-utilities', name: 'Bills & Utilities', color: 'oklch(68% 0.12 240)', order: 30 },
  { id: 'subscription', name: 'Subscription', color: 'oklch(72% 0.12 220)', order: 40 },
  { id: 'food', name: 'Food', color: 'oklch(68% 0.16 25)', order: 50 },
  { id: 'cafe', name: 'Café', color: 'oklch(68% 0.12 70)', order: 60 },
  { id: 'entertainment', name: 'Entertainment', color: 'oklch(68% 0.16 310)', order: 70 },
  { id: 'lifestyle', name: 'Lifestyle', color: 'oklch(68% 0.16 340)', order: 80 },
  { id: 'clothing', name: 'Clothing', color: 'oklch(68% 0.16 10)', order: 90 },
  { id: 'online-purchase', name: 'Online Purchase', color: 'oklch(68% 0.14 275)', order: 100 },
  { id: 'health-medical', name: 'Health / Medical', color: 'oklch(70% 0.12 165)', order: 110 },
  { id: 'investment', name: 'Investment', color: 'oklch(58% 0.14 255)', order: 120 },
  { id: 'charity', name: 'Charity', color: 'oklch(70% 0.13 90)', order: 130 },
  { id: 'gift', name: 'Gift', color: 'oklch(68% 0.16 350)', order: 140 },
  { id: 'one-time-misc', name: 'One-time Misc', color: 'oklch(65% 0.02 80)', order: 150 },
  { id: 'other', name: 'Other', color: 'oklch(65% 0.02 260)', order: 160 },
  { id: 'income', name: 'Income', color: 'oklch(75% 0.15 155)', order: 200, isIncome: true },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Transactions — April 2026 focus, ~60 rows with some March overflow
const TXS = [
  // April 2026 — most recent first
  { id: 't001', date: '2026-04-23', bank: 'amex', merchantRaw: 'WHOLE FOODS MARKET #241', categoryId: 'groceries', amount: 127.43, type: 'spend', categoryConfidence: 0.98, categorySource: 'seed-rule' },
  { id: 't002', date: '2026-04-23', bank: 'bmo', merchantRaw: 'BLUE BOTTLE COFFEE', categoryId: 'cafe', amount: 6.75, type: 'spend', categoryConfidence: 0.96, categorySource: 'user' },
  { id: 't003', date: '2026-04-22', bank: 'amex', merchantRaw: 'UBER TRIP 8JKQM', categoryId: 'transportation', amount: 18.40, type: 'spend', categoryConfidence: 0.99, categorySource: 'merchant-rule' },
  { id: 't004', date: '2026-04-22', bank: 'bmo', merchantRaw: 'E-TRANSFER FROM SARAH K.', categoryId: null, amount: -62.50, type: 'income', categoryConfidence: 0.0, categorySource: 'uncategorized' },
  { id: 't005', date: '2026-04-21', bank: 'scotia', merchantRaw: 'HYDRO ONE NETWORKS', categoryId: 'bills-utilities', amount: 142.18, type: 'spend', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't006', date: '2026-04-21', bank: 'amex', merchantRaw: 'AMAZON.CA*TM8K20I3', categoryId: 'online-purchase', amount: 43.89, type: 'spend', categoryConfidence: 0.72, categorySource: 'merchant-rule', notes: 'replacement headphone cable' },
  { id: 't007', date: '2026-04-20', bank: 'amex', merchantRaw: 'SHELL CANADA 12042', categoryId: 'gas', amount: 68.90, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't008', date: '2026-04-20', bank: 'bmo', merchantRaw: 'NETFLIX.COM', categoryId: 'subscription', amount: 20.99, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't009', date: '2026-04-19', bank: 'amex', merchantRaw: 'IZAKAYA JU', categoryId: 'food', amount: 156.00, type: 'spend', categoryConfidence: 0.68, categorySource: 'merchant-rule', split: { people: 4, myShare: 39.00, originalAmount: 156.00 } },
  { id: 't010', date: '2026-04-19', bank: 'scotia', merchantRaw: 'PAYROLL — ACME CORP', categoryId: 'income', amount: -4250.00, type: 'income', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't011', date: '2026-04-18', bank: 'amex', merchantRaw: 'SPOTIFY PREMIUM', categoryId: 'subscription', amount: 11.99, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't012', date: '2026-04-18', bank: 'bmo', merchantRaw: 'LCBO #0192', categoryId: 'lifestyle', amount: 52.40, type: 'spend', categoryConfidence: 0.88, categorySource: 'merchant-rule' },
  { id: 't013', date: '2026-04-17', bank: 'amex', merchantRaw: 'TST* PIZZERIA LIBRETTO', categoryId: 'food', amount: 48.25, type: 'spend', categoryConfidence: 0.91, categorySource: 'merchant-rule' },
  { id: 't014', date: '2026-04-16', bank: 'scotia', merchantRaw: 'CC PAYMENT — AMEX', categoryId: null, amount: 1284.33, type: 'cc-payment', categoryConfidence: 0.0, categorySource: 'uncategorized' },
  { id: 't015', date: '2026-04-16', bank: 'amex', merchantRaw: 'DOORDASH*SUSHI Q', categoryId: 'food', amount: 34.80, type: 'spend', categoryConfidence: 0.93, categorySource: 'merchant-rule' },
  { id: 't016', date: '2026-04-15', bank: 'amex', merchantRaw: 'APPLE.COM/BILL', categoryId: 'subscription', amount: 2.99, type: 'spend', categoryConfidence: 0.62, categorySource: 'merchant-rule' },
  { id: 't017', date: '2026-04-15', bank: 'bmo', merchantRaw: 'METROLINX PRESTO', categoryId: 'transportation', amount: 42.00, type: 'spend', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't018', date: '2026-04-14', bank: 'amex', merchantRaw: 'THE BAY #1102', categoryId: 'clothing', amount: 218.44, type: 'spend', categoryConfidence: 0.82, categorySource: 'merchant-rule' },
  { id: 't019', date: '2026-04-14', bank: 'amex', merchantRaw: 'STARBUCKS STORE 04112', categoryId: 'cafe', amount: 7.85, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't020', date: '2026-04-13', bank: 'scotia', merchantRaw: 'BELL CANADA MOBILITY', categoryId: 'bills-utilities', amount: 82.00, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't021', date: '2026-04-12', bank: 'amex', merchantRaw: 'LOBLAWS #1442', categoryId: 'groceries', amount: 94.22, type: 'spend', categoryConfidence: 0.99, categorySource: 'seed-rule' },
  { id: 't022', date: '2026-04-12', bank: 'bmo', merchantRaw: 'E-TRANSFER FROM MARK P.', categoryId: null, amount: -125.00, type: 'income', categoryConfidence: 0.0, categorySource: 'uncategorized' },
  { id: 't023', date: '2026-04-11', bank: 'amex', merchantRaw: 'CINEPLEX ODEON VARSITY', categoryId: 'entertainment', amount: 38.50, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule', split: { people: 2, myShare: 19.25, originalAmount: 38.50 } },
  { id: 't024', date: '2026-04-11', bank: 'amex', merchantRaw: 'TIM HORTONS #2044', categoryId: 'cafe', amount: 4.85, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't025', date: '2026-04-10', bank: 'scotia', merchantRaw: 'ENBRIDGE GAS', categoryId: 'bills-utilities', amount: 63.80, type: 'spend', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't026', date: '2026-04-09', bank: 'amex', merchantRaw: 'COSTCO WHOLESALE', categoryId: 'groceries', amount: 287.64, type: 'spend', categoryConfidence: 0.74, categorySource: 'merchant-rule' },
  { id: 't027', date: '2026-04-08', bank: 'amex', merchantRaw: 'SHELL CANADA 09812', categoryId: 'gas', amount: 72.15, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't028', date: '2026-04-07', bank: 'bmo', merchantRaw: 'INDIGO #822', categoryId: 'lifestyle', amount: 34.52, type: 'spend', categoryConfidence: 0.55, categorySource: 'merchant-rule' },
  { id: 't029', date: '2026-04-06', bank: 'amex', merchantRaw: 'MCDONALD\'S #2201', categoryId: 'food', amount: 12.40, type: 'spend', categoryConfidence: 1.0, categorySource: 'seed-rule' },
  { id: 't030', date: '2026-04-05', bank: 'amex', merchantRaw: 'REI CO-OP ONLINE', categoryId: 'clothing', amount: 164.22, type: 'spend', categoryConfidence: 0.69, categorySource: 'merchant-rule' },
  { id: 't031', date: '2026-04-04', bank: 'scotia', merchantRaw: 'QUESTRADE INVESTMENT', categoryId: 'investment', amount: 500.00, type: 'transfer', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't032', date: '2026-04-03', bank: 'amex', merchantRaw: 'FRESHCO #0871', categoryId: 'groceries', amount: 58.33, type: 'spend', categoryConfidence: 0.97, categorySource: 'seed-rule' },
  { id: 't033', date: '2026-04-02', bank: 'bmo', merchantRaw: 'NY PIZZA EMPIRE', categoryId: 'food', amount: 24.80, type: 'spend', categoryConfidence: 0.78, categorySource: 'merchant-rule' },
  { id: 't034', date: '2026-04-02', bank: 'amex', merchantRaw: 'CLAUDE.AI SUBSCRIPTION', categoryId: 'subscription', amount: 20.00, type: 'spend', categoryConfidence: 0.45, categorySource: 'merchant-rule' },
  { id: 't035', date: '2026-04-01', bank: 'scotia', merchantRaw: 'RENT — BLOOR APTS', categoryId: 'bills-utilities', amount: 2150.00, type: 'spend', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't036', date: '2026-04-01', bank: 'amex', merchantRaw: 'GITHUB COPILOT', categoryId: 'subscription', amount: 10.00, type: 'spend', categoryConfidence: 1.0, categorySource: 'user' },

  // March 2026
  { id: 't037', date: '2026-03-30', bank: 'amex', merchantRaw: 'WHOLE FOODS MARKET #241', categoryId: 'groceries', amount: 112.20, type: 'spend', categoryConfidence: 0.98, categorySource: 'seed-rule' },
  { id: 't038', date: '2026-03-29', bank: 'scotia', merchantRaw: 'PAYROLL — ACME CORP', categoryId: 'income', amount: -4250.00, type: 'income', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't039', date: '2026-03-28', bank: 'bmo', merchantRaw: 'AIRBNB*HMX213BZ', categoryId: 'entertainment', amount: 412.00, type: 'spend', categoryConfidence: 0.52, categorySource: 'merchant-rule' },
  { id: 't040', date: '2026-03-26', bank: 'amex', merchantRaw: 'UBER EATS', categoryId: 'food', amount: 28.90, type: 'spend', categoryConfidence: 0.95, categorySource: 'merchant-rule' },
  { id: 't041', date: '2026-03-22', bank: 'amex', merchantRaw: 'LCBO #0192', categoryId: 'lifestyle', amount: 68.00, type: 'spend', categoryConfidence: 0.88, categorySource: 'merchant-rule' },
  { id: 't042', date: '2026-03-20', bank: 'scotia', merchantRaw: 'HYDRO ONE NETWORKS', categoryId: 'bills-utilities', amount: 138.50, type: 'spend', categoryConfidence: 1.0, categorySource: 'user' },
  { id: 't043', date: '2026-03-15', bank: 'amex', merchantRaw: 'SHOPPERS DRUG MART', categoryId: 'health-medical', amount: 48.62, type: 'spend', categoryConfidence: 0.84, categorySource: 'merchant-rule' },
];

// Budgets
const BUDGETS = [
  { categoryId: 'groceries', monthlyLimit: 800 },
  { categoryId: 'food', monthlyLimit: 400 },
  { categoryId: 'cafe', monthlyLimit: 80 },
  { categoryId: 'gas', monthlyLimit: 200 },
  { categoryId: 'transportation', monthlyLimit: 150 },
  { categoryId: 'bills-utilities', monthlyLimit: 2600 },
  { categoryId: 'subscription', monthlyLimit: 80 },
  { categoryId: 'entertainment', monthlyLimit: 150 },
  { categoryId: 'lifestyle', monthlyLimit: 200 },
  { categoryId: 'clothing', monthlyLimit: 250 },
  { categoryId: 'online-purchase', monthlyLimit: 150 },
];

// Outstanding (from split transactions)
const OUTSTANDING = [
  { id: 'o1', transactionId: 't009', personName: 'Aisha', amount: 39.00, status: 'outstanding', createdAt: Date.parse('2026-04-19') },
  { id: 'o2', transactionId: 't009', personName: 'Marcus', amount: 39.00, status: 'outstanding', createdAt: Date.parse('2026-04-19') },
  { id: 'o3', transactionId: 't009', personName: 'Jen', amount: 39.00, status: 'outstanding', createdAt: Date.parse('2026-04-19') },
  { id: 'o4', transactionId: 't023', personName: 'Dani', amount: 19.25, status: 'outstanding', createdAt: Date.parse('2026-04-11') },
];

// Helpers
function fmtCAD(n) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−' : '') + '$' + s;
}
function fmtCompact(n) {
  const abs = Math.abs(n);
  if (abs >= 1000) return (n < 0 ? '−' : '') + '$' + (abs / 1000).toFixed(1) + 'k';
  return fmtCAD(n);
}
function monthKey(dateStr) { return dateStr.slice(0, 7); }
function txsInMonth(month) { return TXS.filter(t => monthKey(t.date) === month && !t.hidden); }

function spendTotal(txs) {
  return txs.filter(t => t.type === 'spend').reduce((s, t) => {
    if (t.split) return s + t.split.myShare;
    return s + t.amount;
  }, 0);
}
function incomeTotal(txs) {
  return txs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
}
function categoryTotals(txs) {
  const m = new Map();
  for (const t of txs) {
    if (t.type !== 'spend') continue;
    const amt = t.split ? t.split.myShare : t.amount;
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + amt);
  }
  return m;
}

Object.assign(window, { CATEGORIES, CAT_MAP, TXS, BUDGETS, OUTSTANDING, fmtCAD, fmtCompact, monthKey, txsInMonth, spendTotal, incomeTotal, categoryTotals });
