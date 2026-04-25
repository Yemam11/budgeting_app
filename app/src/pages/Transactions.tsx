import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Category, Transaction, TxType } from '../types';
import { CategoryBadge } from '../components/CategoryBadge';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { SplitDialog } from '../components/SplitDialog';
import { recategorizeTransaction } from '../lib/recategorize';
import { fmtCAD, monthKey } from '../lib/money';

type TypeFilter = 'all' | TxType | 'needs-review';

export function TransactionsPage() {
  const txs = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const months = useMemo(() => {
    const set = new Set(txs.map((t) => monthKey(t.date)));
    return Array.from(set).sort().reverse();
  }, [txs]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return txs.filter((t) => {
      if (monthFilter !== 'all' && monthKey(t.date) !== monthFilter) return false;
      if (typeFilter === 'needs-review') {
        if (t.type !== 'spend') return false;
        if (t.categorySource === 'user') return false;
        if (t.categoryConfidence >= 0.9) return false;
      } else if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (s && !t.merchantRaw.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [txs, typeFilter, monthFilter, search]);

  async function onCategoryChange(tx: Transaction, newCatId: string | null) {
    const propagate = window.confirm(
      `Apply "${newCatId ? catMap.get(newCatId)?.name ?? newCatId : 'Uncategorized'}" to all past and future transactions from "${tx.merchantRaw}"?\n\nOK = propagate, Cancel = just this one`,
    );
    const res = await recategorizeTransaction(tx.id, newCatId, { propagateToMerchant: propagate });
    if (propagate && res.propagated > 0) {
      setFlash(`Updated ${res.propagated} other transaction${res.propagated === 1 ? '' : 's'} with the same merchant.`);
      setTimeout(() => setFlash(null), 3500);
    }
  }

  async function onTypeChange(tx: Transaction, newType: TxType) {
    await db.transactions.update(tx.id, { type: newType });
  }

  async function onHide(tx: Transaction) {
    await db.transactions.update(tx.id, { hidden: !tx.hidden });
  }

  async function onDelete(tx: Transaction) {
    if (!window.confirm(`Delete this transaction? (${tx.merchantRaw} ${fmtCAD(tx.amount)})`)) return;
    await db.transactions.delete(tx.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="text-sm text-slate-500">{filtered.length.toLocaleString()} rows</div>
      </div>

      {flash && (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{flash}</div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant…"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm w-56"
        />
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="all">All months</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex gap-1 text-sm">
          {(['all', 'needs-review', 'spend', 'income', 'transfer', 'cc-payment'] as TypeFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={`px-2 py-1 rounded border text-xs ${typeFilter === v ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 bg-white'}`}
            >
              {v === 'needs-review' ? 'Needs review' : v === 'cc-payment' ? 'CC payment' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 w-24">Date</th>
              <th className="px-3 py-2 w-16">Bank</th>
              <th className="px-3 py-2">Merchant</th>
              <th className="px-3 py-2 w-28">Type</th>
              <th className="px-3 py-2 w-44">Category</th>
              <th className="px-3 py-2 w-24">Confidence</th>
              <th className="px-3 py-2 text-right w-28">Amount</th>
              <th className="px-3 py-2 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <Row
                key={t.id}
                tx={t}
                category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                categories={categories}
                onCategoryChange={onCategoryChange}
                onTypeChange={onTypeChange}
                onSplit={() => setSplitTx(t)}
                onHide={onHide}
                onDelete={onDelete}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No transactions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {splitTx && <SplitDialog tx={splitTx} onClose={() => setSplitTx(null)} />}
    </div>
  );
}

function Row({
  tx,
  category,
  categories,
  onCategoryChange,
  onTypeChange,
  onSplit,
  onHide,
  onDelete,
}: {
  tx: Transaction;
  category: Category | undefined;
  categories: Category[];
  onCategoryChange: (tx: Transaction, catId: string | null) => void;
  onTypeChange: (tx: Transaction, type: TxType) => void;
  onSplit: () => void;
  onHide: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const hiddenCls = tx.hidden ? 'opacity-50' : '';
  return (
    <tr className={`border-t border-slate-100 ${hiddenCls}`}>
      <td className="px-3 py-2 text-slate-600 tabular-nums">{tx.date}</td>
      <td className="px-3 py-2 text-xs uppercase text-slate-500">{tx.bank}</td>
      <td className="px-3 py-2">
        <div className="font-medium">{tx.merchantRaw}</div>
        {tx.split && (
          <div className="text-xs text-amber-700">
            Split {tx.split.people} ways · your share {fmtCAD(tx.split.myShare)} of {fmtCAD(tx.split.originalAmount)}
          </div>
        )}
        {tx.notes && <div className="text-xs text-slate-500 italic">{tx.notes}</div>}
      </td>
      <td className="px-3 py-2">
        <select
          value={tx.type}
          onChange={(e) => onTypeChange(tx, e.target.value as TxType)}
          className="text-xs rounded border border-slate-200 bg-white px-1 py-0.5"
        >
          <option value="spend">spend</option>
          <option value="income">income</option>
          <option value="transfer">transfer</option>
          <option value="cc-payment">cc-payment</option>
        </select>
      </td>
      <td className="px-3 py-2">
        {tx.type === 'spend' || tx.type === 'income' ? (
          <div className="flex items-center gap-2">
            <CategoryBadge category={category} />
            <select
              value={tx.categoryId ?? ''}
              onChange={(e) => onCategoryChange(tx, e.target.value || null)}
              className="text-xs rounded border border-slate-200 bg-white px-1 py-0.5 max-w-[140px]"
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {tx.type === 'spend' || tx.type === 'income' ? (
          <ConfidenceBar confidence={tx.categoryConfidence} />
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtCAD(tx.amount)}</td>
      <td className="px-3 py-2">
        <div className="flex gap-2 text-xs">
          <button className="text-sky-600 hover:text-sky-800" onClick={onSplit}>{tx.split ? 'Edit split' : 'Split'}</button>
          <button className="text-slate-500 hover:text-slate-700" onClick={() => onHide(tx)}>{tx.hidden ? 'Unhide' : 'Hide'}</button>
          <button className="text-rose-500 hover:text-rose-700" onClick={() => onDelete(tx)}>Del</button>
        </div>
      </td>
    </tr>
  );
}
