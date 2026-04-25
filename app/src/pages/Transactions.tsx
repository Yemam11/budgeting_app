import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Category, Transaction, TxType } from '../types';
import { SplitDialog } from '../components/SplitDialog';
import { recategorizeTransaction } from '../lib/recategorize';
import { fmtCAD, monthKey } from '../lib/money';
import { Icon, BankLogo, CatSwatch, ConfBar } from '../components/Primitives';

type TypeFilter = 'all' | TxType | 'needs-review';
const PAGE_SIZE = 20;

export function TransactionsPage() {
  const txs = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const outstandingEntries = useLiveQuery(() => db.outstanding.where('status').notEqual('settled').toArray(), []) ?? [];
  const thresholdSetting = useLiveQuery(() => db.settings.get('confidenceThreshold'), []);
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const confidenceThreshold: number = (thresholdSetting?.value as number ?? 0.9);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const months = useMemo(() => {
    const set = new Set(txs.map(t => monthKey(t.date)));
    return Array.from(set).sort().reverse();
  }, [txs]);

  const visibleTxs = useMemo(() => txs.filter(t => !t.hidden), [txs]);

  const typeCounts = useMemo(() => ({
    all: visibleTxs.length,
    'needs-review': visibleTxs.filter(t => t.type === 'spend' && t.categorySource !== 'user' && t.categoryConfidence < confidenceThreshold).length,
    spend: visibleTxs.filter(t => t.type === 'spend').length,
    income: visibleTxs.filter(t => t.type === 'income').length,
    transfer: visibleTxs.filter(t => t.type === 'transfer').length,
    'cc-payment': visibleTxs.filter(t => t.type === 'cc-payment').length,
  }), [visibleTxs, confidenceThreshold]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return visibleTxs.filter(t => {
      if (monthFilter !== 'all' && monthKey(t.date) !== monthFilter) return false;
      if (typeFilter === 'needs-review') {
        if (t.type !== 'spend') return false;
        if (t.categorySource === 'user') return false;
        if (t.categoryConfidence >= confidenceThreshold) return false;
      } else if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (s && !t.merchantRaw.toLowerCase().includes(s) && !t.merchantNormalized?.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [visibleTxs, typeFilter, monthFilter, search, confidenceThreshold]);

  useEffect(() => { setPage(0); }, [typeFilter, monthFilter, search]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);

  const spend = useMemo(() => visibleTxs.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0), [visibleTxs]);
  const income = useMemo(() => visibleTxs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0), [visibleTxs]);
  const outstandingTotal = useMemo(() => outstandingEntries.reduce((s, e) => s + e.amount, 0), [outstandingEntries]);

  async function onCategoryChange(tx: Transaction, newCatId: string | null) {
    const propagate = window.confirm(
      `Apply "${newCatId ? catMap.get(newCatId)?.name ?? newCatId : 'Uncategorized'}" to all past and future transactions from "${tx.merchantRaw}"?\n\nOK = propagate to all · Cancel = just this one`,
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
    if (!window.confirm(`Delete "${tx.merchantRaw} ${fmtCAD(tx.amount)}"?`)) return;
    await db.transactions.delete(tx.id);
  }

  const FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'needs-review', label: 'Needs review' },
    { id: 'spend', label: 'Spend' },
    { id: 'income', label: 'Income' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'cc-payment', label: 'CC payment' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ledger</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Transactions</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{visibleTxs.length.toLocaleString()} entries</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={monthFilter} onChange={e => { setMonthFilter(e.target.value); }} className="btn btn-ghost" style={{ appearance: 'none', paddingRight: 28, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
            <option value="all">All months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn btn-primary"><Icon name="plus" size={14} />Add transaction</button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total spend', value: fmtCAD(spend), delta: 0, tone: 'default' as const },
          { label: 'Income', value: fmtCAD(income), delta: 0, tone: 'accent' as const },
          { label: 'Needs review', value: `${typeCounts['needs-review']} txns`, sub: `below ${Math.round(confidenceThreshold * 100)}% confidence`, tone: 'warn' as const },
          { label: 'Outstanding', value: fmtCAD(outstandingTotal), sub: `${outstandingEntries.length} people owe you`, tone: 'default' as const },
        ].map(s => (
          <div key={s.label} className="glass" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: s.tone === 'accent' ? 'oklch(50% 0.15 160)' : s.tone === 'warn' ? 'oklch(55% 0.14 75)' : 'var(--ink)' }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {flash && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent), transparent 60%)', color: 'var(--accent-ink)', fontSize: 13 }}>{flash}</div>
      )}

      {/* Toolbar */}
      <div className="glass" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>
            <Icon name="search" size={14} />
          </div>
          <input className="input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search merchant…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg-control" style={{ flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.id} className={`seg-btn${typeFilter === f.id ? ' active' : ''}`} onClick={() => setTypeFilter(f.id)}>
              {f.label}
              <span className="mono" style={{ fontSize: 10, color: typeFilter === f.id ? 'var(--ink-mute)' : 'var(--ink-mute)' }}>
                {typeCounts[f.id as keyof typeof typeCounts] ?? ''}
              </span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost"><Icon name="sort" size={12} />Date ↓</button>
      </div>

      {/* Table */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Date</th>
              <th style={{ width: 52 }}>Bank</th>
              <th>Merchant</th>
              <th style={{ width: 80 }}>Type</th>
              <th style={{ width: 170 }}>Category</th>
              <th style={{ width: 110 }}>Confidence</th>
              <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-mute)', fontSize: 13 }}>No transactions match these filters.</td></tr>
            ) : paged.map(t => (
              <TxRow
                key={t.id}
                tx={t}
                category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                categories={categories}
                confidenceThreshold={confidenceThreshold}
                onCategoryChange={onCategoryChange}
                onTypeChange={onTypeChange}
                onSplit={() => setSplitTx(t)}
                onHide={onHide}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-mute)' }}>
            <div>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {splitTx && <SplitDialog tx={splitTx} onClose={() => setSplitTx(null)} />}
    </div>
  );
}

function TxRow({
  tx, category, categories, confidenceThreshold,
  onCategoryChange, onTypeChange, onSplit, onHide, onDelete,
}: {
  tx: Transaction;
  category: Category | undefined;
  categories: Category[];
  confidenceThreshold: number;
  onCategoryChange: (tx: Transaction, catId: string | null) => void;
  onTypeChange: (tx: Transaction, type: TxType) => void;
  onSplit: () => void;
  onHide: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isIncome = tx.type === 'income';
  const needsReview = tx.type === 'spend' && tx.categorySource !== 'user' && tx.categoryConfidence < confidenceThreshold;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <tr style={{ opacity: tx.hidden ? 0.45 : 1 }}>
      <td className="mono" style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{tx.date.slice(5)}</td>
      <td><BankLogo bank={tx.bank} size={20} /></td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{tx.merchantRaw}</span>
          {needsReview && <span className="chip chip-warn" style={{ fontSize: 10, padding: '1px 6px' }}>review</span>}
        </div>
        {tx.split && (
          <div style={{ fontSize: 11, color: 'oklch(58% 0.1 75)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="split" size={10} />Split {tx.split.people} ways · {fmtCAD(tx.split.myShare)} mine
          </div>
        )}
        {tx.notes && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', marginTop: 2 }}>"{tx.notes}"</div>}
      </td>
      <td>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', background: 'oklch(50% 0.01 260 / 0.06)', padding: '2px 6px', borderRadius: 6, display: 'inline-block' }}>
            {tx.type}
          </span>
          <select
            value={tx.type}
            onChange={e => onTypeChange(tx, e.target.value as TxType)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
          >
            {(['spend','income','transfer','cc-payment'] as TxType[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </td>
      <td>
        {tx.type === 'spend' || tx.type === 'income' ? (
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <span className="chip" style={category ? {
              background: `color-mix(in oklab, ${category.color}, transparent 86%)`,
              borderColor: `color-mix(in oklab, ${category.color}, transparent 70%)`,
              color: `color-mix(in oklab, ${category.color}, black 20%)`,
            } : { color: 'var(--ink-mute)' }}>
              {category && <CatSwatch color={category.color} size={6} />}
              {category?.name ?? 'Uncategorized'}
              <Icon name="chevron_down" size={10} />
            </span>
            <select
              value={tx.categoryId ?? ''}
              onChange={e => onCategoryChange(tx, e.target.value || null)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
            >
              <option value="">Uncategorized</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ) : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
      </td>
      <td>
        {(tx.type === 'spend' || tx.type === 'income') && tx.categoryConfidence > 0
          ? <ConfBar c={tx.categoryConfidence} />
          : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
      </td>
      <td className="mono" style={{ textAlign: 'right', fontWeight: 500, color: isIncome ? 'oklch(50% 0.15 160)' : 'var(--ink)' }}>
        {isIncome ? '+' : ''}{fmtCAD(Math.abs(tx.amount))}
      </td>
      <td>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button className="btn" style={{ padding: 4, border: 'none', background: 'transparent', color: 'var(--ink-mute)' }} onClick={() => setMenuOpen(v => !v)}>
            <Icon name="more" size={16} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 6, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: tx.split ? 'Edit split' : 'Split', action: () => { onSplit(); setMenuOpen(false); } },
                { label: tx.hidden ? 'Unhide' : 'Hide', action: () => { onHide(tx); setMenuOpen(false); } },
                { label: 'Delete', action: () => { onDelete(tx); setMenuOpen(false); }, danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 7, border: 'none', background: 'transparent', fontSize: 12, color: item.danger ? 'var(--danger)' : 'var(--ink)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, white 60%, transparent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
