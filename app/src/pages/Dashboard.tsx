import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import {
  fmtCAD, fmtCompact, currentMonthKey, prevMonth, lastNMonths, monthKey,
  effectiveTxsInMonth, categoryTotals, totalSpend, totalIncome,
} from '../lib/money';
import type { SavingsGoal, InvestmentAccount, Holding } from '../types';
import { Icon, Delta } from '../components/Primitives';
import { CashflowBars, Sankey, ProgressRing } from '../components/Charts';

const SI_ACCOUNTS_DEFAULT: InvestmentAccount[] = [
  { id: 'tfsa', name: 'TFSA', institution: 'Questrade', roomLeft: 47500 },
  { id: 'rrsp', name: 'RRSP', institution: 'Questrade' },
  { id: 'fhsa', name: 'FHSA', institution: 'Questrade', roomLeft: 7400 },
];

const SI_GOALS_DEFAULT: SavingsGoal[] = [
  { id: 'sg1', name: 'House Down Payment', target: 50000, pct: 50, color: 'oklch(58% 0.18 250)' },
  { id: 'sg2', name: 'New Car',            target: 20000, pct: 30, color: 'oklch(62% 0.16 155)' },
  { id: 'sg3', name: 'Emergency Fund',     target: 15000, pct: 20, color: 'oklch(66% 0.15 45)'  },
];

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthAbbr = (k: string) => MONTH_ABBR[parseInt(k.slice(5, 7), 10) - 1];
const monthFull = (k: string) => {
  const full = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${full[parseInt(k.slice(5, 7), 10) - 1]} ${k.slice(0, 4)}`;
};

interface Props { onNavigate?: (tab: string) => void; userName?: string }

export function DashboardPage({ onNavigate, userName }: Props) {
  // ── Core data ─────────────────────────────────────────────────────
  const txs        = useQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const budgets    = useQuery(() => db.budgets.toArray(), []) ?? [];
  const thresholdSetting = useQuery(() => db.settings.get('confidenceThreshold'), []);
  const confidenceThreshold: number = (thresholdSetting?.value as number ?? 0.9);
  void confidenceThreshold;

  // ── Net worth data ─────────────────────────────────────────────────
  const savingsOvSetting       = useQuery(() => db.settings.get('si_savings_override'), []);
  const savingsOvBaseSetting   = useQuery(() => db.settings.get('si_savings_override_base'), []);
  const flexBalanceSetting     = useQuery(() => db.settings.get('si_flex_balance'), []);
  const siGoalsSetting         = useQuery(() => db.settings.get('si_goals'), []);
  const mvOverridesSetting     = useQuery(() => db.settings.get('si_mv_overrides'), []);
  const sharesOverridesSetting = useQuery(() => db.settings.get('si_shares_overrides'), []);
  const siAccountsSetting      = useQuery(() => db.settings.get('si_accounts'), []);
  const holdingsData           = useQuery(() => db.holdings.toArray(), []) ?? [];

  const [nwPrices, setNwPrices] = useState<Record<string, number | null>>({});

  const tickerKey = useMemo(() =>
    (holdingsData as Holding[]).map(h => h.ticker).sort().join(','),
  [holdingsData]);

  useEffect(() => {
    if (!tickerKey) return;
    fetch(`/api/prices?tickers=${encodeURIComponent(tickerKey)}`)
      .then(r => r.json())
      .then(d => setNwPrices(d.prices ?? {}))
      .catch(() => {});
  }, [tickerKey]);

  // ── Derived NW values ──────────────────────────────────────────────
  const goals: SavingsGoal[] = useMemo(() =>
    (siGoalsSetting?.value as SavingsGoal[] | undefined) ?? SI_GOALS_DEFAULT,
  [siGoalsSetting]);

  const savingsBalance = useMemo(() => {
    const fromTxs = txs.filter(t => t.type === 'savings' && !t.hidden).reduce((s, t) => s + t.amount, 0);
    const ov   = savingsOvSetting?.value as number | null ?? null;
    const base = savingsOvBaseSetting?.value as number ?? 0;
    return ov !== null ? ov + (fromTxs - base) : fromTxs;
  }, [txs, savingsOvSetting, savingsOvBaseSetting]);

  const flexBalance = (flexBalanceSetting?.value as number | undefined) ?? 0;

  const investMV = useMemo(() => {
    const accounts  = (siAccountsSetting?.value as InvestmentAccount[] | undefined) ?? SI_ACCOUNTS_DEFAULT;
    const mvOv      = (mvOverridesSetting?.value as Record<string, { value: number; base: number }> | undefined) ?? {};
    const sharesOv  = (sharesOverridesSetting?.value as Record<string, { value: number; base: number }> | undefined) ?? {};
    const investTxs = txs.filter(t => t.type === 'investment' && !t.hidden);
    return accounts.reduce((total, acct) => {
      const raw = investTxs.filter(t => t.investmentAccount === acct.id).reduce((s, t) => s + t.amount, 0);
      const computed = (holdingsData as Holding[])
        .filter(h => h.accountId === acct.id)
        .reduce((s, h) => {
          const shOv   = sharesOv[h.id];
          const shares = shOv ? shOv.value + (h.shares - shOv.base) : h.shares;
          return s + shares * (nwPrices[h.ticker] ?? 0);
        }, 0);
      const mvEntry = mvOv[acct.id];
      const mv      = mvEntry ? mvEntry.value + (computed - mvEntry.base) : computed;
      return total + (mv > 0 ? mv : raw);
    }, 0);
  }, [txs, siAccountsSetting, mvOverridesSetting, sharesOverridesSetting, holdingsData, nwPrices]);

  const netWorth = savingsBalance + investMV + flexBalance;

  // ── UI state ──────────────────────────────────────────────────────
  const [selectedMonth,    setSelectedMonth]    = useState(currentMonthKey());
  const [customFrom,       setCustomFrom]       = useState('');
  const [customTo,         setCustomTo]         = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [sankeyExpanded,   setSankeyExpanded]   = useState(false);
  // Expanded-view pan/zoom state
  const [exTx,    setExTx]    = useState(0);
  const [exTy,    setExTy]    = useState(0);
  const [exScale, setExScale] = useState(1);
  const [exDrag,  setExDrag]  = useState<{ ox: number; oy: number; tx: number; ty: number } | null>(null);

  const hasCustomRange = !!(customFrom || customTo);

  const availableMonths = useMemo(() => {
    const set = new Set(txs.map(t => monthKey(t.date)));
    set.add(currentMonthKey());
    return Array.from(set).sort().reverse();
  }, [txs]);

  const catMap    = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const budgetMap = useMemo(() => new Map(budgets.map(b => [b.categoryId, b.monthlyLimit])), [budgets]);

  const thisMonth    = selectedMonth;
  const prevMonthKey = prevMonth(thisMonth);

  const monthTxs = useMemo(() => {
    if (hasCustomRange) {
      return txs.filter(t => (!customFrom || t.date >= customFrom) && (!customTo || t.date <= customTo));
    }
    return effectiveTxsInMonth(txs, thisMonth);
  }, [txs, hasCustomRange, customFrom, customTo, thisMonth]);
  const prevMonthTxs = useMemo(() => effectiveTxsInMonth(txs, prevMonthKey), [txs, prevMonthKey]);

  const totals     = useMemo(() => categoryTotals(monthTxs), [monthTxs]);
  const spend      = totalSpend(monthTxs);
  const income     = totalIncome(monthTxs);
  const net        = income - spend;
  const prevSpend  = totalSpend(prevMonthTxs);
  const prevIncome = totalIncome(prevMonthTxs);
  const prevNet    = prevIncome - prevSpend;

  const spendDelta  = prevSpend > 0  ? ((spend  - prevSpend)  / prevSpend)         * 100 : 0;
  const incomeDelta = prevIncome > 0 ? ((income - prevIncome) / prevIncome)         * 100 : 0;
  const netDelta    = Math.abs(prevNet) > 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : 0;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  // ── Cash-flow — last 3 months ending at selectedMonth ────────────
  const cashflowData = useMemo(() => {
    const months: string[] = [];
    let mk = selectedMonth;
    for (let i = 0; i < 3; i++) { months.unshift(mk); mk = prevMonth(mk); }
    return months.map(m => ({
      label:  monthAbbr(m),
      income: totalIncome(effectiveTxsInMonth(txs, m)),
      spend:  totalSpend(effectiveTxsInMonth(txs, m)),
    }));
  }, [txs, selectedMonth]);

  // ── Sankey ────────────────────────────────────────────────────────
  const sankeyInflows = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.type !== 'income' || t.hidden) continue;
      const name = t.categoryId ? (catMap.get(t.categoryId)?.name ?? 'Income') : 'Income';
      m.set(name, (m.get(name) ?? 0) + Math.abs(t.amount));
    }
    if (m.size === 0 && income > 0) return [{ label: 'Income', value: income }];
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, value]) => ({ label, value }));
  }, [monthTxs, catMap, income]);

  const sankeyOutflows = useMemo(() => {
    const nodes: { label: string; value: number; color: string }[] = [];

    // All spend categories (no slice cap), filter zero values
    for (const [id, value] of Array.from(totals.entries()).sort((a, b) => b[1] - a[1])) {
      if (value < 1) continue;
      nodes.push({ label: catMap.get(id)?.name ?? 'Other', value, color: catMap.get(id)?.color ?? 'oklch(65% 0.02 260)' });
    }

    // Savings & investment outflows
    const savingsOut = monthTxs.filter(t => t.type === 'savings' && !t.hidden).reduce((s, t) => s + t.amount, 0);
    if (savingsOut >= 1) nodes.push({ label: 'Savings', value: savingsOut, color: 'oklch(58% 0.18 250)' });

    const investOut = monthTxs.filter(t => t.type === 'investment' && !t.hidden).reduce((s, t) => s + t.amount, 0);
    if (investOut >= 1) nodes.push({ label: 'Invested', value: investOut, color: 'oklch(52% 0.18 278)' });

    // Balance: add "Unallocated" node if income exceeds total tracked outflows
    const totalTracked = nodes.reduce((s, n) => s + n.value, 0);
    const unallocated  = income - totalTracked;
    if (unallocated >= 50) nodes.push({ label: 'Unallocated', value: unallocated, color: 'oklch(62% 0.03 260)' });

    return nodes;
  }, [totals, catMap, monthTxs, income]);

  const sankeyHeight = Math.max(300, sankeyOutflows.length * 42 + 60);

  // ── Budget burn-down ──────────────────────────────────────────────
  const today          = new Date();
  const isCurrentMonth = selectedMonth === currentMonthKey();
  const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
  const dayOfMonth  = isCurrentMonth ? today.getDate() : new Date(selYear, selMonthNum, 0).getDate();
  const daysInMonth = new Date(selYear, selMonthNum, 0).getDate();
  const paceFrac    = dayOfMonth / daysInMonth;

  const budgetRows = useMemo(() =>
    categories
      .filter(c => !c.isIncome && !c.archived && (budgetMap.get(c.id) ?? 0) > 0)
      .map(c => {
        const limit = budgetMap.get(c.id) ?? 0;
        const spent = totals.get(c.id) ?? 0;
        return { c, limit, spent, pct: limit > 0 ? spent / limit : 0 };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6),
  [categories, budgetMap, totals]);

  // ── Savings summary ───────────────────────────────────────────────
  const lockedTotal  = goals.filter(g => g.locked).reduce((s, g) => s + (g.lockedValue ?? 0), 0);
  const freeBalance  = savingsBalance - lockedTotal;
  const activePctSum = goals.filter(g => !g.locked).reduce((s, g) => s + g.pct, 0);

  const avgMonthlySavings = useMemo(() => {
    const months = lastNMonths(6);
    const total  = months.reduce((s, mk) =>
      s + txs.filter(t => t.type === 'savings' && !t.hidden && monthKey(t.date) === mk).reduce((ss, t) => ss + t.amount, 0),
    0);
    return total / 6;
  }, [txs]);

  // ── Expand overlay pan/zoom handlers ─────────────────────────────
  const expandMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setExDrag({ ox: e.clientX, oy: e.clientY, tx: exTx, ty: exTy });
  };
  const expandMouseMove = (e: React.MouseEvent) => {
    if (!exDrag) return;
    setExTx(exDrag.tx + (e.clientX - exDrag.ox));
    setExTy(exDrag.ty + (e.clientY - exDrag.oy));
  };
  const expandMouseUp   = () => setExDrag(null);
  const expandWheel     = (e: React.WheelEvent) => {
    e.preventDefault();
    setExScale(s => Math.max(0.4, Math.min(4, s - e.deltaY * 0.001)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Overview · {hasCustomRange ? 'Custom Time Period' : monthFull(thisMonth)}</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>{greeting}{userName ? `, ${userName}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select
              value={hasCustomRange ? '' : selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setCustomFrom(''); setCustomTo(''); }}
              className="btn btn-ghost"
              style={{ appearance: 'none', paddingLeft: 32, paddingRight: 28, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', opacity: hasCustomRange ? 0.45 : 1 }}
            >
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-mute)' }}>
              <Icon name="calendar" size={14} />
            </div>
          </div>
          {(showCustomPicker || hasCustomRange) ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" className="btn btn-ghost" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} title="Start date" />
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1 }}>→</span>
              <input type="date" className="btn btn-ghost" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} value={customTo} onChange={e => setCustomTo(e.target.value)} title="End date" />
              <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => { setCustomFrom(''); setCustomTo(''); setShowCustomPicker(false); }}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowCustomPicker(true)}>
              <Icon name="calendar" size={12} />Custom Time Period
            </button>
          )}
          <button className="btn btn-primary" onClick={() => onNavigate?.('import')}><Icon name="upload" size={14} />Import statement</button>
        </div>
      </div>

      {/* ── Hero band ──────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, oklch(20% 0.015 260), oklch(15% 0.02 260))',
        borderRadius: 22, padding: '28px 32px', color: 'white', overflow: 'hidden',
        boxShadow: '0 20px 40px -20px oklch(15% 0.05 260 / 0.5), inset 0 1px 0 oklch(100% 0 0 / 0.08)',
        border: '1px solid oklch(30% 0.02 260)',
      }}>
        <div className="hero-pattern" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 8, fontWeight: 500 }}>{hasCustomRange ? 'Net this period' : 'Net this month'}</div>
              <div className="mono" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtCAD(net)}</div>
              {!hasCustomRange && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Delta value={netDelta} />
                  <span style={{ fontSize: 12, color: 'oklch(65% 0.02 260)' }}>vs. {monthAbbr(prevMonthKey)} · {fmtCAD(prevNet)}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 28, paddingBottom: 4 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Money in</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'var(--accent)' }}>+{fmtCAD(income)}</div>
                {!hasCustomRange && <Delta value={incomeDelta} />}
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Money out</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'oklch(95% 0.01 260)' }}>−{fmtCAD(Math.abs(spend))}</div>
                {!hasCustomRange && <Delta value={spendDelta} />}
              </div>
              <div style={{ borderLeft: '1px solid oklch(100% 0 0 / 0.12)', paddingLeft: 28 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Net Worth</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'oklch(78% 0.15 160)' }}>{fmtCAD(netWorth)}</div>
                <div style={{ fontSize: 10, color: 'oklch(55% 0.02 260)', marginTop: 3 }}>
                  {fmtCompact(savingsBalance)} saved · {fmtCompact(investMV)} invested · {fmtCompact(flexBalance)} flex
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ background: 'oklch(100% 0 0 / 0.1)', color: 'white', border: '1px solid oklch(100% 0 0 / 0.15)' }} onClick={() => onNavigate?.('transactions')}><Icon name="transactions" size={14} />View all</button>
          </div>
        </div>
      </div>

      {/* ── Row 1: Cash flow + Budget burn-down ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>

        {/* Cash flow */}
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Cash flow</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                {monthAbbr(prevMonth(prevMonth(selectedMonth)))} – {monthAbbr(selectedMonth)}
              </div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onNavigate?.('transactions')}>
              View transactions →
            </button>
          </div>
          <CashflowBars data={cashflowData} height={200} />
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--ink-soft)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />Income
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(35% 0.015 260)', display: 'inline-block' }} />Spending
            </span>
          </div>
        </div>

        {/* Budget burn-down */}
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Budget burn-down</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Day {dayOfMonth} of {daysInMonth} · {Math.round(paceFrac * 100)}% through month</div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onNavigate?.('budgets')}>
              View budgets →
            </button>
          </div>
          {budgetRows.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, padding: '30px 0' }}>Set limits on the Budgets tab</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {budgetRows.map(({ c, limit, spent, pct }) => {
                const over = pct > 1;
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ProgressRing pct={pct} size={40} thickness={4} color={c.color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                        <div className="mono" style={{ fontSize: 11, color: over ? 'var(--danger)' : 'var(--ink-soft)' }}>
                          {fmtCompact(spent)} / {fmtCompact(limit)}
                        </div>
                      </div>
                      <div style={{ position: 'relative', height: 10 }}>
                        <div className="bar-track" style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 6 }}>
                          <div className={over ? 'bar-fill danger' : 'bar-fill'} style={{ width: Math.min(pct * 100, 100) + '%', background: over ? undefined : c.color }} />
                        </div>
                        <div style={{ position: 'absolute', top: 0, left: `${paceFrac * 100}%`, transform: 'translateX(-50%)', width: 2, height: 10, background: 'var(--ink-2)', opacity: 0.35, borderRadius: 1 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Sankey ──────────────────────────────────────────── */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Money flow</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
              How {hasCustomRange ? 'your' : `${monthAbbr(thisMonth)}'s`} income was allocated
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => { setSankeyExpanded(true); setExTx(0); setExTy(0); setExScale(1); }}>
            <Icon name="arrow_up_right" size={12} /> Expand
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 4 }}>
          <div>Sources</div><div style={{ textAlign: 'center' }}>Flow</div><div style={{ textAlign: 'right' }}>Destinations</div>
        </div>
        <Sankey income={sankeyInflows} outflows={sankeyOutflows} height={sankeyHeight} />
      </div>

      {/* ── Row 3: Savings summary ──────────────────────────────────── */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Savings summary</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Goals · progress · pace</div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onNavigate?.('savings')}>
            View savings →
          </button>
        </div>

        {/* Totals row */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 3 }}>Total Saved</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{fmtCAD(savingsBalance)}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 3 }}>Invested</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{fmtCAD(investMV)}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 3 }}>Flex</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: flexBalance >= 0 ? 'oklch(50% 0.16 160)' : 'var(--danger)' }}>
              {flexBalance >= 0 ? '' : '−'}{fmtCAD(Math.abs(flexBalance))}
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 3 }}>Avg. monthly savings</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink-soft)' }}>{fmtCAD(avgMonthlySavings)}</div>
          </div>
        </div>

        {/* Goal cards — vertical stack */}
        {goals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, padding: '20px 0' }}>
            Add savings goals on the Savings tab
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goals.map(goal => {
              const allocated = goal.locked
                ? (goal.lockedValue ?? 0)
                : Math.max(0, (goal.pct / 100) * freeBalance);
              const progress      = goal.target > 0 ? Math.min(1, allocated / goal.target) : 0;
              const remaining     = Math.max(0, goal.target - allocated);
              const goalPct       = activePctSum > 0 ? goal.pct / activePctSum : 0;
              const monthlyContrib = goal.locked ? 0 : avgMonthlySavings * goalPct;
              let paceLabel: string;
              if (allocated >= goal.target)      paceLabel = 'Goal reached';
              else if (monthlyContrib <= 0)      paceLabel = 'No savings rate';
              else {
                const months = remaining / monthlyContrib;
                if (months > 120)   paceLabel = '10+ years';
                else if (months >= 24) paceLabel = `~${Math.round(months / 12)} years`;
                else                paceLabel = `~${Math.ceil(months)} months`;
              }
              const reachedGoal = allocated >= goal.target;
              return (
                <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: 'var(--card-surface)', border: '1px solid var(--line)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: goal.color, flexShrink: 0, boxShadow: `0 0 0 3px color-mix(in oklab, ${goal.color}, transparent 78%)` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{goal.name}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        {fmtCAD(allocated)} <span style={{ color: 'var(--ink-mute)' }}>/ {fmtCAD(goal.target)}</span>
                      </div>
                    </div>
                    <div className="bar-track" style={{ height: 5 }}>
                      <div className="bar-fill" style={{ width: Math.round(progress * 100) + '%', background: goal.color }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--ink-mute)' }}>
                      <span>{Math.round(progress * 100)}% complete</span>
                      <span style={{ color: reachedGoal ? 'oklch(50% 0.16 160)' : 'var(--ink-mute)' }}>{paceLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sankey expand overlay ───────────────────────────────────── */}
      {sankeyExpanded && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'oklch(0% 0 0 / 0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSankeyExpanded(false); }}
        >
          <div style={{ width: '92vw', maxWidth: 1200, height: '90vh', background: 'var(--bg)', borderRadius: 20, boxShadow: '0 32px 80px -20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>Money flow — expanded</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Drag to pan · scroll to zoom</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setExTx(0); setExTy(0); setExScale(1); }}>Reset</button>
                <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setSankeyExpanded(false)}><Icon name="x" size={14} /></button>
              </div>
            </div>
            <div
              style={{ flex: 1, overflow: 'hidden', cursor: exDrag ? 'grabbing' : 'grab', userSelect: 'none', padding: 20 }}
              onMouseDown={expandMouseDown}
              onMouseMove={expandMouseMove}
              onMouseUp={expandMouseUp}
              onMouseLeave={expandMouseUp}
              onWheel={expandWheel}
            >
              <div style={{ transform: `translate(${exTx}px, ${exTy}px) scale(${exScale})`, transformOrigin: '0 0', transition: exDrag ? 'none' : 'transform 0.1s' }}>
                <Sankey income={sankeyInflows} outflows={sankeyOutflows} height={Math.max(560, sankeyOutflows.length * 48 + 60)} expanded={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
