import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fmtCAD, categoryTotals, currentMonthKey, txsInMonth } from '../lib/money';

export function BudgetsPage() {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [monthKeyState, setMonthKeyState] = useState(currentMonthKey());

  const monthTxs = useMemo(() => txsInMonth(txs, monthKeyState), [txs, monthKeyState]);
  const totals = useMemo(() => categoryTotals(monthTxs), [monthTxs]);
  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b.monthlyLimit])), [budgets]);

  async function setLimit(categoryId: string, value: string) {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      await db.budgets.delete(categoryId);
      return;
    }
    await db.budgets.put({ categoryId, monthlyLimit: num });
  }

  const availableMonths = useMemo(() => {
    const set = new Set(txs.map((t) => t.date.slice(0, 7)));
    set.add(currentMonthKey());
    return Array.from(set).sort().reverse();
  }, [txs]);

  const totalBudget = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = Array.from(totals.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <select
          value={monthKeyState}
          onChange={(e) => setMonthKeyState(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500 tracking-wide">Spent this month</div>
          <div className="text-2xl font-semibold tabular-nums">{fmtCAD(totalSpent)}</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500 tracking-wide">Total budgeted</div>
          <div className="text-2xl font-semibold tabular-nums">{fmtCAD(totalBudget)}</div>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 w-32 text-right">Spent</th>
              <th className="px-3 py-2 w-36 text-right">Monthly limit</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2 w-24 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {categories.filter((c) => !c.archived && !c.isIncome).map((c) => {
              const spent = totals.get(c.id) ?? 0;
              const limit = budgetMap.get(c.id) ?? 0;
              const pct = limit > 0 ? Math.min(spent / limit, 2) : 0;
              const over = limit > 0 && spent > limit;
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtCAD(spent)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="10"
                      defaultValue={limit || ''}
                      onBlur={(e) => setLimit(c.id, e.target.value)}
                      placeholder="—"
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {limit > 0 ? (
                      <div className="h-2 rounded bg-slate-100 overflow-hidden">
                        <div
                          className={over ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'}
                          style={{ width: `${Math.min(pct * 100, 100)}%` }}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No limit</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums text-sm ${over ? 'text-rose-600' : 'text-slate-600'}`}>
                    {limit > 0 ? fmtCAD(limit - spent) : ''}
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
