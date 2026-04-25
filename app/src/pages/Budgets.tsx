import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fmtCAD, categoryTotals, currentMonthKey, txsInMonth } from '../lib/money';
import { Icon, CatSwatch, Delta } from '../components/Primitives';

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthLabel = (k: string) => `${MONTH_FULL[parseInt(k.slice(5, 7), 10) - 1]} ${k.slice(0, 4)}`;

export function BudgetsPage() {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [monthKeyState, setMonthKeyState] = useState(currentMonthKey());
  const [editingId, setEditingId] = useState<string | null>(null);

  const monthTxs = useMemo(() => txsInMonth(txs, monthKeyState), [txs, monthKeyState]);
  const totals = useMemo(() => categoryTotals(monthTxs), [monthTxs]);
  const budgetMap = useMemo(() => new Map(budgets.map(b => [b.categoryId, b.monthlyLimit])), [budgets]);

  const availableMonths = useMemo(() => {
    const set = new Set(txs.map(t => t.date.slice(0, 7)));
    set.add(currentMonthKey());
    return Array.from(set).sort().reverse();
  }, [txs]);

  const today = new Date();
  const isCurrentMonth = monthKeyState === currentMonthKey();
  const dayOfMonth = isCurrentMonth ? today.getDate() : 30;
  const daysInMonth = isCurrentMonth
    ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    : new Date(parseInt(monthKeyState.slice(0, 4)), parseInt(monthKeyState.slice(5, 7)), 0).getDate();
  const paceFrac = dayOfMonth / daysInMonth;

  const totalBudget = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = Array.from(totals.values()).reduce((s, v) => s + v, 0);
  const expected = totalBudget * paceFrac;
  const pace = totalSpent - expected;

  const rows = useMemo(() =>
    categories
      .filter(c => !c.archived && !c.isIncome)
      .map(c => {
        const spent = totals.get(c.id) ?? 0;
        const limit = budgetMap.get(c.id) ?? 0;
        const pct = limit > 0 ? spent / limit : 0;
        return { c, spent, limit, pct };
      })
      .sort((a, b) => (b.limit > 0 ? 1 : 0) - (a.limit > 0 ? 1 : 0) || b.pct - a.pct),
    [categories, totals, budgetMap],
  );

  const onTrack = rows.filter(r => r.limit > 0 && r.pct <= 1).length;
  const atRisk = rows.filter(r => r.limit > 0 && r.pct > paceFrac && r.pct <= 1).length;
  const over = rows.filter(r => r.limit > 0 && r.pct > 1).length;

  async function setLimit(categoryId: string, value: string) {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      await db.budgets.delete(categoryId);
    } else {
      await db.budgets.put({ categoryId, monthlyLimit: num });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Budgets</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Monthly limits</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{monthLabel(monthKeyState)} · Day {dayOfMonth} of {daysInMonth}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={monthKeyState} onChange={e => setMonthKeyState(e.target.value)} className="btn btn-ghost" style={{ appearance: 'none', paddingRight: 28, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn btn-primary"><Icon name="plus" size={14} />Add budget</button>
        </div>
      </div>

      {/* Hero summary */}
      <div className="glass" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 32, alignItems: 'center' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Spent this month</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>{fmtCAD(totalSpent)}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>of {fmtCAD(totalBudget)} budgeted</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Remaining</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: 'oklch(50% 0.15 160)' }}>{fmtCAD(Math.max(totalBudget - totalSpent, 0))}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>{daysInMonth - dayOfMonth} days left</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pace</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: pace > 0 ? 'var(--danger)' : 'oklch(50% 0.15 160)' }}>
            {pace > 0 ? '+' : ''}{fmtCAD(pace)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>{pace > 0 ? 'Above' : 'Below'} expected pace</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Overall progress</div>
          <div style={{ position: 'relative', height: 10, marginBottom: 8 }}>
            <div className="bar-track" style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 6 }}>
              <div className="bar-fill" style={{ width: totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) + '%' : '0%', background: 'linear-gradient(90deg, var(--accent), oklch(70% 0.16 165))' }} />
            </div>
            <div style={{ position: 'absolute', top: 0, left: `${paceFrac * 100}%`, transform: 'translateX(-50%)', width: 2, height: 10, background: 'var(--ink-2)', opacity: 0.4, borderRadius: 1 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
            <span>{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</span>
            <span>Expected {Math.round(paceFrac * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Budget table */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>All categories</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {onTrack > 0 && <span className="chip chip-accent"><Icon name="check" size={10} />{onTrack} on track</span>}
            {atRisk > 0 && <span className="chip chip-warn">{atRisk} at risk</span>}
            {over > 0 && <span className="chip chip-danger">{over} over</span>}
          </div>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ width: 110, textAlign: 'right' }}>Spent</th>
              <th style={{ width: 150, textAlign: 'right' }}>Monthly limit</th>
              <th style={{ width: 220 }}>Progress</th>
              <th style={{ width: 110, textAlign: 'right' }}>Remaining</th>
              <th style={{ width: 80, textAlign: 'right' }}>Pace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, spent, limit, pct }) => {
              const isOver = limit > 0 && spent > limit;
              const expectedCat = limit * paceFrac;
              const paceCat = spent - expectedCat;
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CatSwatch color={c.color} size={8} />
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>
                    {limit > 0 ? fmtCAD(spent) : <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>{fmtCAD(spent)}</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === c.id ? (
                      <input
                        type="number" autoFocus step="10"
                        defaultValue={limit || ''}
                        className="input"
                        style={{ width: 100, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, padding: '4px 8px' }}
                        onBlur={e => { setLimit(c.id, e.target.value); setEditingId(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingId(null); }}
                      />
                    ) : limit > 0 ? (
                      <span className="mono" style={{ fontWeight: 500, cursor: 'pointer' }} onClick={() => setEditingId(c.id)}>{fmtCAD(limit)}</span>
                    ) : (
                      <button onClick={() => setEditingId(c.id)} style={{ background: 'transparent', border: '1px dashed var(--line-strong)', padding: '3px 10px', borderRadius: 7, fontSize: 11, color: 'var(--ink-mute)', cursor: 'pointer' }}>Set limit</button>
                    )}
                  </td>
                  <td>
                    {limit > 0 ? (
                      <div style={{ position: 'relative', height: 10 }}>
                        <div className="bar-track" style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 6 }}>
                          <div className={isOver ? 'bar-fill danger' : 'bar-fill'} style={{ width: Math.min(pct * 100, 100) + '%', background: isOver ? undefined : c.color }} />
                        </div>
                        <div style={{ position: 'absolute', top: 0, left: `${paceFrac * 100}%`, transform: 'translateX(-50%)', width: 2, height: 10, background: 'var(--ink-2)', opacity: 0.35, borderRadius: 1 }} />
                      </div>
                    ) : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: isOver ? 'var(--danger)' : 'var(--ink-2)', fontWeight: 500 }}>
                    {limit > 0 ? (isOver ? '−' : '') + fmtCAD(Math.abs(limit - spent)) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {limit > 0 && <Delta value={(paceCat / limit) * 100} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
