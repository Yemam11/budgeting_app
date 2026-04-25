import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { db } from '../db';
import {
  fmtCAD, currentMonthKey, lastNMonths, txsInMonth, categoryTotals,
  totalSpend, totalIncome,
} from '../lib/money';

const EMPTY_COLOR = '#cbd5e1';

export function DashboardPage() {
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b.monthlyLimit])), [budgets]);

  const thisMonth = currentMonthKey();
  const monthTxs = useMemo(() => txsInMonth(txs, thisMonth), [txs, thisMonth]);
  const totals = useMemo(() => categoryTotals(monthTxs), [monthTxs]);

  const pieData = useMemo(() =>
    Array.from(totals.entries())
      .filter(([, v]) => v > 0)
      .map(([catId, v]) => ({
        name: catMap.get(catId)?.name ?? 'Uncategorized',
        value: Math.round(v * 100) / 100,
        color: catMap.get(catId)?.color ?? EMPTY_COLOR,
      }))
      .sort((a, b) => b.value - a.value),
    [totals, catMap],
  );

  const spend = totalSpend(monthTxs);
  const income = totalIncome(monthTxs);

  const months = useMemo(() => lastNMonths(6), []);
  const momData = useMemo(() => {
    return months.map((m) => {
      const row: Record<string, number | string> = { month: m };
      const byCat = categoryTotals(txsInMonth(txs, m));
      for (const c of categories) {
        if (c.isIncome) continue;
        row[c.name] = Math.round((byCat.get(c.id) ?? 0) * 100) / 100;
      }
      return row;
    });
  }, [months, txs, categories]);

  const topCats = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of momData) {
      for (const c of categories) {
        if (c.isIncome) continue;
        totals.set(c.name, (totals.get(c.name) ?? 0) + (row[c.name] as number));
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [momData, categories]);

  const topCatColors = useMemo(() => {
    const m = new Map(categories.map((c) => [c.name, c.color]));
    return topCats.map((n) => m.get(n) ?? EMPTY_COLOR);
  }, [topCats, categories]);

  const budgetRows = useMemo(() =>
    categories
      .filter((c) => !c.isIncome && !c.archived && (budgetMap.get(c.id) ?? 0) > 0)
      .map((c) => {
        const limit = budgetMap.get(c.id) ?? 0;
        const spent = totals.get(c.id) ?? 0;
        return { c, limit, spent, pct: limit > 0 ? spent / limit : 0 };
      })
      .sort((a, b) => b.pct - a.pct),
    [categories, budgetMap, totals],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard · {thisMonth}</h1>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Spent this month" value={fmtCAD(spend)} tone="rose" />
        <Stat label="Income" value={fmtCAD(income)} tone="emerald" />
        <Stat label="Net" value={fmtCAD(income - spend)} tone={income - spend >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Spending by category (this month)">
          {pieData.length === 0 ? (
            <Empty>No spending yet this month.</Empty>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={1}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCAD(v)} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Month-over-month (top categories)">
          {momData.every((r) => topCats.every((k) => r[k] === 0)) ? (
            <Empty>Import a couple months to see month-over-month.</Empty>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={momData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmtCAD(v)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {topCats.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={topCatColors[i]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Budget progress (this month)">
        {budgetRows.length === 0 ? (
          <Empty>Set monthly limits on the Budgets tab to see progress here.</Empty>
        ) : (
          <div className="space-y-2">
            {budgetRows.map(({ c, limit, spent, pct }) => {
              const over = spent > limit;
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                    <span className={`tabular-nums ${over ? 'text-rose-600' : 'text-slate-600'}`}>
                      {fmtCAD(spent)} / {fmtCAD(limit)}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-slate-100 overflow-hidden">
                    <div className={over ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-500 py-6 text-center">{children}</div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'rose' | 'emerald' | 'slate' }) {
  const toneCls = tone === 'rose' ? 'text-rose-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-700';
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
