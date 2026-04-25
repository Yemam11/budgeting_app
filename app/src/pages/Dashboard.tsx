import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  fmtCAD, fmtCompact, currentMonthKey, prevMonth, lastNMonths, monthKey,
  txsInMonth, categoryTotals, totalSpend, totalIncome,
} from '../lib/money';
import type { Category } from '../types';
import { Icon, BankLogo, CatSwatch, Delta, ConfBar } from '../components/Primitives';
import { CashflowBars, Donut, StackedBars, Sankey, ProgressRing } from '../components/Charts';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthAbbr = (k: string) => MONTH_ABBR[parseInt(k.slice(5, 7), 10) - 1];
const monthFull = (k: string) => {
  const full = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${full[parseInt(k.slice(5, 7), 10) - 1]} ${k.slice(0, 4)}`;
};

interface Props { onNavigate?: (tab: string) => void }

export function DashboardPage({ onNavigate }: Props) {
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? [];
  const thresholdSetting = useLiveQuery(() => db.settings.get('confidenceThreshold'), []);
  const confidenceThreshold: number = (thresholdSetting?.value as number ?? 0.9);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const availableMonths = useMemo(() => {
    const set = new Set(txs.map(t => monthKey(t.date)));
    set.add(currentMonthKey());
    return Array.from(set).sort().reverse();
  }, [txs]);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const budgetMap = useMemo(() => new Map(budgets.map(b => [b.categoryId, b.monthlyLimit])), [budgets]);

  const thisMonth = selectedMonth;
  const prevMonthKey = prevMonth(thisMonth);

  const monthTxs = useMemo(() => txsInMonth(txs, thisMonth), [txs, thisMonth]);
  const prevMonthTxs = useMemo(() => txsInMonth(txs, prevMonthKey), [txs, prevMonthKey]);

  const totals = useMemo(() => categoryTotals(monthTxs), [monthTxs]);
  const spend = totalSpend(monthTxs);
  const income = totalIncome(monthTxs);
  const net = income - spend;

  const prevSpend = totalSpend(prevMonthTxs);
  const prevIncome = totalIncome(prevMonthTxs);
  const prevNet = prevIncome - prevSpend;

  const spendDelta = prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : 0;
  const incomeDelta = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;
  const netDelta = Math.abs(prevNet) > 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : 0;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  // Donut: top categories this month
  const donutData = useMemo(() =>
    Array.from(totals.entries())
      .filter(([, v]) => v > 0)
      .map(([id, value]) => ({ label: catMap.get(id)?.name ?? 'Other', value, color: catMap.get(id)?.color ?? '#aaa' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7),
    [totals, catMap],
  );

  // Weekly cashflow — last 12 weeks
  const cashflowData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, wi) => {
      const weekOffset = 11 - wi;
      const end = new Date(now);
      end.setDate(end.getDate() - weekOffset * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const s = start.toISOString().slice(0, 10);
      const e = end.toISOString().slice(0, 10);
      const week = txs.filter(t => t.date >= s && t.date <= e);
      return { label: `W${wi + 1}`, income: totalIncome(week), spend: totalSpend(week) };
    });
  }, [txs]);

  // Sankey
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
    const entries = Array.from(totals.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 5).map(([id, value]) => ({
      label: catMap.get(id)?.name ?? 'Other', value, color: catMap.get(id)?.color ?? '#aaa',
    }));
    const otherTotal = entries.slice(5).reduce((s, [, v]) => s + v, 0);
    if (otherTotal > 0) top.push({ label: 'Other', value: otherTotal, color: 'oklch(65% 0.02 260)' });
    return top;
  }, [totals, catMap]);

  // 6-month stacked bars
  const sixMonths = useMemo(() => lastNMonths(6), []);
  const topStackCats = useMemo(() => {
    const acc = new Map<string, number>();
    for (const mk of sixMonths) {
      for (const [id, v] of categoryTotals(txsInMonth(txs, mk)).entries()) {
        acc.set(id, (acc.get(id) ?? 0) + v);
      }
    }
    return Array.from(acc.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id]) => catMap.get(id)).filter((c): c is Category => c !== undefined);
  }, [txs, sixMonths, catMap]);

  const stackedMonths = useMemo(() =>
    sixMonths.map(mk => ({
      label: monthAbbr(mk),
      values: Object.fromEntries(categoryTotals(txsInMonth(txs, mk))),
    })),
    [txs, sixMonths],
  );

  // Budget burndown — pace markers relative to selected month
  const today = new Date();
  const isCurrentMonth = selectedMonth === currentMonthKey();
  const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
  const dayOfMonth = isCurrentMonth ? today.getDate() : new Date(selYear, selMonthNum, 0).getDate();
  const daysInMonth = new Date(selYear, selMonthNum, 0).getDate();
  const paceFrac = dayOfMonth / daysInMonth;

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
    [categories, budgetMap, totals],
  );

  // Recent activity — scoped to selected month
  const recentTxs = useMemo(() =>
    monthTxs.filter(t => !t.hidden).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [txs],
  );

  const needsReviewCount = useMemo(() =>
    txs.filter(t => t.type === 'spend' && !t.hidden && t.categorySource !== 'user' && t.categoryConfidence < confidenceThreshold).length,
    [txs, confidenceThreshold],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Overview · {monthFull(thisMonth)}</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>{greeting}, Youssef</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="btn btn-ghost"
              style={{ appearance: 'none', paddingLeft: 32, paddingRight: 28, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-mute)' }}>
              <Icon name="calendar" size={14} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate?.('import')}><Icon name="upload" size={14} />Import statement</button>
        </div>
      </div>

      {/* Hero band */}
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
              <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 8, fontWeight: 500 }}>Net this month</div>
              <div className="mono" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtCAD(net)}</div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Delta value={netDelta} />
                <span style={{ fontSize: 12, color: 'oklch(65% 0.02 260)' }}>vs. {monthAbbr(prevMonthKey)} · {fmtCAD(prevNet)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28, paddingBottom: 4 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Money in</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'var(--accent)' }}>+{fmtCAD(income)}</div>
                <Delta value={incomeDelta} />
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Money out</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'oklch(95% 0.01 260)' }}>−{fmtCAD(spend)}</div>
                <Delta value={spendDelta} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ background: 'oklch(100% 0 0 / 0.1)', color: 'white', border: '1px solid oklch(100% 0 0 / 0.15)' }} onClick={() => onNavigate?.('transactions')}><Icon name="transactions" size={14} />View all</button>
          </div>
        </div>
      </div>

      {/* Row 1: Cashflow + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Cash flow</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Weekly · last 12 weeks</div>
            </div>
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

        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Where it went</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{donutData.length} categories</div>
            </div>
          </div>
          {donutData.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, padding: '40px 0' }}>No spending this month</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Donut data={donutData} size={160} thickness={18} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>Spent</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>{fmtCompact(spend)}</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, maxWidth: 220, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {donutData.slice(0, 5).map(d => (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                    <CatSwatch color={d.color} size={7} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{d.label}</span>
                    <span className="mono" style={{ flexShrink: 0, color: 'var(--ink-2)', fontWeight: 500, fontSize: 11 }}>{fmtCompact(d.value)}</span>
                    <span className="mono" style={{ flexShrink: 0, color: 'var(--ink-mute)', fontSize: 10, width: 26, textAlign: 'right' }}>
                      {spend > 0 ? ((d.value / spend) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Sankey */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Money flow</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>How {monthAbbr(thisMonth)}'s income was allocated</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 4 }}>
          <div>Sources</div><div style={{ textAlign: 'center' }}>Flow</div><div style={{ textAlign: 'right' }}>Destinations</div>
        </div>
        <Sankey income={sankeyInflows} outflows={sankeyOutflows} height={200} />
      </div>

      {/* Row 3: Spend trend + Budget burndown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Spending trend</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>By category · last 6 months</div>
          </div>
          {topStackCats.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, padding: '40px 0' }}>Import a few months of data to see trends</div>
          ) : (
            <>
              <StackedBars months={stackedMonths} categories={topStackCats} height={200} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, fontSize: 11, color: 'var(--ink-soft)' }}>
                {topStackCats.map(c => (
                  <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <CatSwatch color={c.color} size={7} />{c.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Budget burn-down</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Day {dayOfMonth} of {daysInMonth} · {Math.round(paceFrac * 100)}% through month</div>
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

      {/* Row 4: Recent activity */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 14px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Recent activity</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
              Newest first{needsReviewCount > 0 && ` · ${needsReviewCount} needing review`}{selectedMonth !== currentMonthKey() && ` · ${monthFull(selectedMonth)}`}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => onNavigate?.('transactions')}>View all</button>
        </div>
        {recentTxs.length === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>No transactions yet — import a statement to get started.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Date</th>
                <th>Merchant</th>
                <th style={{ width: 150 }}>Category</th>
                <th style={{ width: 120 }}>Confidence</th>
                <th style={{ width: 60 }}>Bank</th>
                <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTxs.map(t => {
                const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
                const isIncome = t.type === 'income';
                return (
                  <tr key={t.id}>
                    <td className="mono" style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{t.date.slice(5)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.merchantRaw}</div>
                      {t.split && <div style={{ fontSize: 11, color: 'oklch(58% 0.1 75)', marginTop: 2 }}>Split {t.split.people} ways · {fmtCAD(t.split.myShare)} yours</div>}
                    </td>
                    <td>
                      {cat ? (
                        <span className="chip" style={{ background: `color-mix(in oklab, ${cat.color}, transparent 86%)`, borderColor: `color-mix(in oklab, ${cat.color}, transparent 70%)`, color: `color-mix(in oklab, ${cat.color}, black 20%)` }}>
                          <CatSwatch color={cat.color} size={6} />{cat.name}
                        </span>
                      ) : (t.type === 'spend' || t.type === 'income') ? (
                        <span className="chip" style={{ color: 'var(--ink-mute)' }}>Uncategorized</span>
                      ) : (
                        <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td>
                      {(t.type === 'spend' || t.type === 'income') && t.categoryConfidence > 0
                        ? <ConfBar c={t.categoryConfidence} />
                        : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
                    </td>
                    <td><BankLogo bank={t.bank} size={20} /></td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 500, color: isIncome ? 'oklch(50% 0.15 160)' : 'var(--ink)' }}>
                      {isIncome ? '+' : ''}{fmtCAD(Math.abs(t.amount))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
