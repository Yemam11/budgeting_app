import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { nanoid } from 'nanoid';
import { db } from '../db';
import type { Bank, Category, Transaction, TxType } from '../types';
import { SplitDialog } from '../components/SplitDialog';
import { ContactPicker } from '../components/ContactPicker';
import { recategorizeTransaction, undoRecategorize, type UndoData } from '../lib/recategorize';
import { fmtCAD, monthKey, currentMonthKey } from '../lib/money';
import { Icon, BankLogo, CatSwatch, ConfBar } from '../components/Primitives';

const TYPE_LABEL: Record<string, string> = {
  spend: 'Spend',
  income: 'Income',
  transfer: 'Transfer',
  'cc-payment': 'CC Payment',
  'needs-review': 'Needs Review',
};

const TYPE_LABEL_FULL: Record<string, string> = {
  ...TYPE_LABEL,
  'cc-payment': 'Credit Card Payment',
};

type TypeFilter = 'all' | TxType | 'needs-review';
type DatePreset = 'all' | 'this-month' | 'last-30' | 'last-3m' | 'ytd' | string;

function getDateCutoff(preset: DatePreset): string | null {
  const now = new Date();
  if (preset === 'all') return null;
  if (preset === 'this-month') return currentMonthKey() + '-01';
  if (preset === 'last-30') { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }
  if (preset === 'last-3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }
  if (preset === 'ytd') return `${now.getFullYear()}-01-01`;
  return null;
}

export function TransactionsPage() {
  const txs = useQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) ?? [];
  const categories = useQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const outstandingEntries = useQuery(() => db.outstanding.where('status').notEqual('settled').toArray(), []) ?? [];
  const thresholdSetting = useQuery(() => db.settings.get('confidenceThreshold'), []);
  const contacts = useQuery(() => db.contacts.toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const confidenceThreshold: number = (thresholdSetting?.value as number ?? 0.9);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [flash, setFlash] = useState<{ text: string; undo: UndoData | null } | null>(null);
  const [showAddTx, setShowAddTx] = useState(false);
  const [owedTx, setOwedTx] = useState<Transaction | null>(null);
  const [owedName, setOwedName] = useState('');
  const [propagateDialog, setPropagateDialog] = useState<{
    tx: Transaction; newCatId: string | null; catName: string;
  } | null>(null);

  const months = useMemo(() => {
    const set = new Set(txs.map(t => monthKey(t.date)));
    return Array.from(set).sort().reverse();
  }, [txs]);

  const visibleTxs = useMemo(() => txs.filter(t => !t.hidden), [txs]);
  const owedTxIds = useMemo(() => new Set(outstandingEntries.map(e => e.transactionId)), [outstandingEntries]);

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
    const cutoff = getDateCutoff(dateFilter);
    const isMonthFilter = /^\d{4}-\d{2}$/.test(dateFilter);
    return visibleTxs.filter(t => {
      const hasCustomDates = customFrom || customTo;
      if (hasCustomDates) {
        if (customFrom && t.date < customFrom) return false;
        if (customTo && t.date > customTo) return false;
      } else if (isMonthFilter) {
        if (monthKey(t.date) !== dateFilter) return false;
      } else if (cutoff) {
        if (t.date < cutoff) return false;
      }
      if (typeFilter === 'needs-review') {
        if (t.type !== 'spend' || t.categorySource === 'user' || t.categoryConfidence >= confidenceThreshold) return false;
      } else if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (s && !t.merchantRaw.toLowerCase().includes(s) && !(t.merchantNormalized?.toLowerCase().includes(s)) && !(t.notes?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [visibleTxs, typeFilter, dateFilter, customFrom, customTo, search, confidenceThreshold]);

  const spend = useMemo(() => visibleTxs.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0), [visibleTxs]);
  const income = useMemo(() => visibleTxs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0), [visibleTxs]);
  const outstandingTotal = useMemo(() => outstandingEntries.reduce((s, e) => s + e.amount, 0), [outstandingEntries]);

  function requestCategoryChange(tx: Transaction, newCatId: string | null) {
    setPropagateDialog({ tx, newCatId, catName: newCatId ? (catMap.get(newCatId)?.name ?? newCatId) : 'Uncategorized' });
  }

  async function confirmCategoryChange(propagate: boolean) {
    if (!propagateDialog) return;
    const { tx, newCatId } = propagateDialog;
    setPropagateDialog(null);
    const res = await recategorizeTransaction(tx.id, newCatId, { propagateToMerchant: propagate });
    const text = propagate && res.propagated > 0
      ? `Updated ${res.propagated + 1} transaction${res.propagated === 0 ? '' : 's'} from the same merchant.`
      : 'Category updated.';
    setFlash({ text, undo: res.undo });
    setTimeout(() => setFlash(null), 5000);
  }

  async function undoLastChange() {
    if (!flash?.undo) return;
    const undo = flash.undo;
    setFlash(null);
    await undoRecategorize(undo);
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

  async function onSaveNote(tx: Transaction, note: string) {
    await db.transactions.update(tx.id, { notes: note.trim() || undefined });
  }

  async function onMarkReviewed(tx: Transaction) {
    await db.transactions.update(tx.id, { categorySource: 'user', categoryConfidence: 1 });
  }

  async function confirmOwed() {
    if (!owedTx || !owedName.trim()) return;
    const name = owedName.trim();
    const exists = contacts.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (!exists) await db.contacts.add({ id: nanoid(), name, createdAt: Date.now() });
    await db.outstanding.add({
      id: nanoid(),
      transactionId: owedTx.id,
      personName: name,
      amount: Math.abs(owedTx.amount),
      createdAt: Date.now(),
      status: 'outstanding',
    });
    setFlash({ text: `${name} owes you ${fmtCAD(Math.abs(owedTx.amount))}.`, undo: null });
    setTimeout(() => setFlash(null), 4000);
    setOwedTx(null);
    setOwedName('');
  }

  const FILTERS: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'needs-review', label: 'Needs Review' },
    { id: 'spend', label: 'Spend' },
    { id: 'income', label: 'Income' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'cc-payment', label: 'Credit Card Payment' },
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
          <select
            value={dateFilter} onChange={e => { setDateFilter(e.target.value); setCustomFrom(''); setCustomTo(''); }}
            className="btn btn-ghost"
            style={{ appearance: 'none', paddingRight: 28, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
          >
            <option value="all">All time</option>
            <option value="this-month">This month</option>
            <option value="last-30">Last 30 days</option>
            <option value="last-3m">Last 3 months</option>
            <option value="ytd">Year to date</option>
            <optgroup label="By month">
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </optgroup>
          </select>
          <input type="date" className="btn btn-ghost" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} value={customFrom} onChange={e => { setCustomFrom(e.target.value); setDateFilter('all'); }} title="From date" />
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>→</span>
          <input type="date" className="btn btn-ghost" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} value={customTo} onChange={e => { setCustomTo(e.target.value); setDateFilter('all'); }} title="To date" />
          <button className="btn btn-primary" onClick={() => setShowAddTx(true)}>
            <Icon name="plus" size={14} />Add transaction
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total spend', value: fmtCAD(spend), tone: 'default' as const },
          { label: 'Income', value: fmtCAD(income), tone: 'accent' as const },
          { label: 'Needs review', value: String(typeCounts['needs-review']), sub: `below ${Math.round(confidenceThreshold * 100)}% confidence`, tone: 'warn' as const },
          { label: 'Outstanding', value: fmtCAD(outstandingTotal), sub: `${outstandingEntries.length} ${outstandingEntries.length === 1 ? 'person owes' : 'people owe'} you`, tone: 'default' as const },
        ].map(s => (
          <div key={s.label} className="glass" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: s.tone === 'accent' ? 'oklch(50% 0.15 160)' : s.tone === 'warn' ? 'oklch(55% 0.14 75)' : 'var(--ink)' }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {flash && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent), transparent 60%)', color: 'var(--accent-ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{flash.text}</span>
          {flash.undo && (
            <button className="btn btn-ghost" style={{ fontSize: 11, flexShrink: 0 }} onClick={undoLastChange}>
              Undo
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="glass" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>
            <Icon name="search" size={14} />
          </div>
          <input className="input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search merchant or notes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="seg-control" style={{ flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.id} className={`seg-btn${typeFilter === f.id ? ' active' : ''}`} onClick={() => setTypeFilter(f.id)}>
              {f.label}
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                {typeCounts[f.id as keyof typeof typeCounts] ?? ''}
              </span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {filtered.length !== visibleTxs.length && (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {filtered.length.toLocaleString()} of {visibleTxs.length.toLocaleString()}
          </div>
        )}
      </div>

      {/* Table — scrollable */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
          <table className="data" style={{ tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'oklch(98.5% 0.003 260)', boxShadow: '0 1px 0 var(--line)' }}>
              <tr>
                <th style={{ width: 80 }}>Date</th>
                <th style={{ width: 52 }}>Bank</th>
                <th>Merchant</th>
                <th style={{ width: 200, textAlign: 'right' }}></th>
                <th style={{ width: 110 }}>Type</th>
                <th style={{ width: 170 }}>Category</th>
                <th style={{ width: 110 }}>Confidence</th>
                <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-mute)', fontSize: 13 }}>No transactions match these filters.</td></tr>
              ) : filtered.map(t => (
                <TxRow
                  key={t.id}
                  tx={t}
                  category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                  categories={categories}
                  confidenceThreshold={confidenceThreshold}
                  isOwed={owedTxIds.has(t.id)}
                  onCategoryChange={requestCategoryChange}
                  onTypeChange={onTypeChange}
                  onSplit={() => setSplitTx(t)}
                  onHide={onHide}
                  onDelete={onDelete}
                  onSaveNote={onSaveNote}
                  onMarkOwed={() => { setOwedTx(t); setOwedName(''); }}
                  onMarkReviewed={onMarkReviewed}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-mute)' }}>
          {filtered.length.toLocaleString()} transactions
        </div>
      </div>

      {splitTx && <SplitDialog tx={splitTx} onClose={() => setSplitTx(null)} />}

      {/* Categorization propagation dialog */}
      {propagateDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPropagateDialog(null)}>
          <div className="glass" style={{ padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Update category</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 20 }}>
              Apply <strong style={{ color: 'var(--ink)' }}>{propagateDialog.catName}</strong> to <em>"{propagateDialog.tx.merchantRaw}"</em> — apply to:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} autoFocus onClick={() => confirmCategoryChange(true)}>
                <Icon name="check" size={14} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div>All transactions from this merchant</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 1 }}>Saves a merchant rule for future imports too</div>
                </div>
              </button>
              <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '10px 14px' }} onClick={() => confirmCategoryChange(false)}>
                <Icon name="transactions" size={14} />
                <div style={{ textAlign: 'left' }}>Just this one transaction</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as owed dialog */}
      {owedTx && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOwedTx(null)}>
          <div className="glass" style={{ padding: 24, maxWidth: 380, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Mark as owed</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 18 }}>
              {owedTx.merchantRaw} · <span className="mono">{fmtCAD(Math.abs(owedTx.amount))}</span><br />
              <span style={{ fontSize: 11 }}>You paid the full amount — who owes you?</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <ContactPicker
                value={owedName}
                onChange={setOwedName}
                contacts={contacts}
                placeholder="Person's name (e.g. Mom)"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') confirmOwed(); if (e.key === 'Escape') setOwedTx(null); }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOwedTx(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!owedName.trim()} onClick={confirmOwed}>
                <Icon name="owed" size={14} />Create owed entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add transaction modal */}
      {showAddTx && <AddTxModal categories={categories} onClose={() => setShowAddTx(false)} />}
    </div>
  );
}

function TxRow({
  tx, category, categories, confidenceThreshold, isOwed,
  onCategoryChange, onTypeChange, onSplit, onHide, onDelete, onSaveNote, onMarkOwed, onMarkReviewed,
}: {
  tx: Transaction;
  category: Category | undefined;
  categories: Category[];
  confidenceThreshold: number;
  isOwed: boolean;
  onCategoryChange: (tx: Transaction, catId: string | null) => void;
  onTypeChange: (tx: Transaction, type: TxType) => void;
  onSplit: () => void;
  onHide: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onSaveNote: (tx: Transaction, note: string) => void;
  onMarkOwed: () => void;
  onMarkReviewed: (tx: Transaction) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ right: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyPos, setModifyPos] = useState<{ right: number; top: number } | null>(null);
  const modifyBtnRef = useRef<HTMLButtonElement>(null);
  const modifyDropdownRef = useRef<HTMLDivElement>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(tx.notes ?? '');
  const deletingNoteRef = useRef(false);
  const [spreadOpen, setSpreadOpen] = useState(false);
  const isIncome = tx.type === 'income';
  const needsReview = tx.type === 'spend' && tx.categorySource !== 'user' && tx.categoryConfidence < confidenceThreshold;

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (!btnRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => {
    if (!modifyOpen) return;
    function close(e: MouseEvent) {
      if (!modifyBtnRef.current?.contains(e.target as Node) && !modifyDropdownRef.current?.contains(e.target as Node)) {
        setModifyOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [modifyOpen]);

  useEffect(() => { setNoteValue(tx.notes ?? ''); }, [tx.notes]);

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    setMenuOpen(true);
  }

  function openModify() {
    const rect = modifyBtnRef.current?.getBoundingClientRect();
    if (rect) setModifyPos({ right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    setModifyOpen(true);
  }

  function saveNote() {
    if (deletingNoteRef.current) { deletingNoteRef.current = false; return; }
    setEditingNote(false);
    onSaveNote(tx, noteValue);
  }

  // 3-dot menu: only hide and delete
  const menuItems = [
    { label: tx.hidden ? 'Unhide' : 'Hide', action: () => { onHide(tx); setMenuOpen(false); } },
    { label: 'Delete', action: () => { onDelete(tx); setMenuOpen(false); }, danger: true },
  ];

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 10, padding: '2px 7px', borderRadius: 5,
    border: 'none', background: 'oklch(50% 0.01 260 / 0.07)',
    color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <>
      <tr style={{ opacity: tx.hidden ? 0.45 : 1 }}>
        <td className="mono" style={{ color: 'var(--ink-mute)', fontSize: 12 }}>{tx.date.slice(5)}</td>
        <td><BankLogo bank={tx.bank} size={20} /></td>
        <td>
          {/* Merchant name + status chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>{tx.merchantRaw}</span>
            {needsReview && (
              <button
                className="chip chip-warn"
                style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}
                onClick={() => onMarkReviewed(tx)}
                title="Categorization looks correct? Click to mark as reviewed"
              >
                Review ✓
              </button>
            )}
            {isOwed && <span className="chip chip-accent" style={{ fontSize: 10, padding: '1px 6px' }}>Owed</span>}
          </div>
          {/* Split info */}
          {tx.split && (
            <div style={{ fontSize: 11, color: 'oklch(58% 0.1 75)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="split" size={10} />Split {tx.split.people} ways · {fmtCAD(tx.split.myShare)} mine
            </div>
          )}
          {/* Spread info */}
          {tx.spreadMonths && tx.spreadMonths > 1 && (
            <div style={{ fontSize: 11, color: 'oklch(55% 0.12 220)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="calendar" size={10} />Spread {tx.spreadMonths} months · {fmtCAD(Math.abs(tx.amount) / tx.spreadMonths)}/mo
            </div>
          )}
          {/* Note */}
          {editingNote ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <input
                value={noteValue}
                onChange={e => setNoteValue(e.target.value)}
                onBlur={saveNote}
                onKeyDown={e => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') { setEditingNote(false); setNoteValue(tx.notes ?? ''); } }}
                placeholder="Add a note…"
                autoFocus
                className="input"
                style={{ fontSize: 11, padding: '3px 8px', flex: 1, maxWidth: 240 }}
              />
              {tx.notes && (
                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 7px', borderRadius: 5, border: 'none', background: 'oklch(50% 0.01 260 / 0.07)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  title="Delete note"
                  onMouseDown={() => { deletingNoteRef.current = true; }}
                  onClick={() => { setEditingNote(false); setNoteValue(''); onSaveNote(tx, ''); }}
                >
                  <Icon name="x" size={9} />Delete
                </button>
              )}
            </div>
          ) : tx.notes ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', cursor: 'pointer' }} onClick={() => setEditingNote(true)} title="Click to edit note">
                "{tx.notes}"
              </div>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, padding: '1px 4px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}
                title="Delete note"
                onClick={() => onSaveNote(tx, '')}
              >
                <Icon name="x" size={9} />
              </button>
            </div>
          ) : null}
        </td>
        {/* Action buttons — between Merchant and Type, right-aligned */}
        <td style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            <button style={actionBtn} onClick={() => setEditingNote(true)}>
              <Icon name="plus" size={9} />{tx.notes ? 'Edit note' : 'Note'}
            </button>
            <button ref={modifyBtnRef} style={actionBtn} onClick={openModify}>
              Modify <Icon name="chevron_right" size={9} />
            </button>
          </div>
        </td>
        <td>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', background: 'oklch(50% 0.01 260 / 0.06)', padding: '2px 6px', borderRadius: 6, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 94 }}>
              {TYPE_LABEL[tx.type] ?? tx.type}
            </span>
            <select value={tx.type} onChange={e => onTypeChange(tx, e.target.value as TxType)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}>
              {(['spend', 'income', 'transfer', 'cc-payment'] as TxType[]).map(v => <option key={v} value={v}>{TYPE_LABEL_FULL[v]}</option>)}
            </select>
          </div>
        </td>
        <td>
          {tx.type === 'spend' || tx.type === 'income' ? (
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <span className="chip" style={category ? { background: `color-mix(in oklab, ${category.color}, transparent 86%)`, borderColor: `color-mix(in oklab, ${category.color}, transparent 70%)`, color: `color-mix(in oklab, ${category.color}, black 20%)` } : { color: 'var(--ink-mute)' }}>
                {category && <CatSwatch color={category.color} size={6} />}
                {category?.name ?? 'Uncategorized'}
                <Icon name="chevron_down" size={10} />
              </span>
              <select value={tx.categoryId ?? ''} onChange={e => onCategoryChange(tx, e.target.value || null)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}>
                <option value="">Uncategorized</option>
                {categories.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <button ref={btnRef} className="btn" style={{ padding: 4, border: 'none', background: 'transparent', color: 'var(--ink-mute)' }} onClick={openMenu}>
            <Icon name="more" size={16} />
          </button>
        </td>
      </tr>
      {menuOpen && menuPos && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', right: menuPos.right, top: menuPos.top, zIndex: 9999, background: 'color-mix(in oklab, white 85%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 6, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {menuItems.map(item => (
            <button key={item.label} onClick={item.action} style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 7, border: 'none', background: 'transparent', fontSize: 12, color: item.danger ? 'var(--danger)' : 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, white 60%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {modifyOpen && modifyPos && createPortal(
        <div
          ref={modifyDropdownRef}
          style={{ position: 'fixed', right: modifyPos.right, top: modifyPos.top, zIndex: 9999, background: 'color-mix(in oklab, white 85%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', padding: 6, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {[
            { label: tx.split ? 'Edit split' : 'Split', icon: 'split', action: () => { onSplit(); setModifyOpen(false); } },
            ...(tx.type === 'spend' ? [{ label: tx.spreadMonths && tx.spreadMonths > 1 ? 'Edit spread' : 'Spread over months', icon: 'calendar', action: () => { setSpreadOpen(true); setModifyOpen(false); } }] : []),
            ...(tx.type === 'spend' && !isOwed ? [{ label: 'Mark as owed', icon: 'owed', action: () => { onMarkOwed(); setModifyOpen(false); } }] : []),
          ].map(item => (
            <button key={item.label} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '6px 10px', borderRadius: 7, border: 'none', background: 'transparent', fontSize: 12, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, white 60%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Icon name={item.icon} size={13} />
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {spreadOpen && <SpreadMonthsDialog tx={tx} onClose={() => setSpreadOpen(false)} />}
    </>
  );
}

function SpreadMonthsDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [val, setVal] = useState(String(tx.spreadMonths && tx.spreadMonths > 1 ? tx.spreadMonths : 1));
  const n = parseInt(val);
  const valid = Number.isFinite(n) && n >= 1;

  async function save() {
    if (!valid) return;
    await db.transactions.update(tx.id, { spreadMonths: n > 1 ? n : 1 });
    onClose();
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="glass" style={{ padding: 24, maxWidth: 360, width: '90%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Spread over months</div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 18 }}>
          {tx.merchantRaw} · <span className="mono">{fmtCAD(Math.abs(tx.amount))}</span><br />
          <span style={{ fontSize: 11 }}>Split this cost across multiple months for budget tracking.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input
            type="number" min="1" max="60" className="input"
            style={{ width: 80, textAlign: 'center' }}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
            autoFocus
          />
          <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>months</span>
          {valid && n > 1 && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
              = {fmtCAD(Math.abs(tx.amount) / n)}/mo
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {tx.spreadMonths && tx.spreadMonths > 1 && (
            <button
              className="btn btn-ghost"
              style={{ color: 'var(--danger)' }}
              onClick={async () => { await db.transactions.update(tx.id, { spreadMonths: 1 }); onClose(); }}
            >
              Remove spread
            </button>
          )}
          <button className="btn btn-primary" disabled={!valid} onClick={save}>
            <Icon name="check" size={13} />Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AddTxModal({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TxType>('spend');
  const [categoryId, setCategoryId] = useState('');
  const [bank, setBank] = useState<Bank>('amex');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const amt = parseFloat(amount);
    if (!merchant.trim()) { setErr('Merchant name is required.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a valid amount.'); return; }
    setBusy(true);
    setErr('');
    const actualAmount = type === 'income' ? -amt : amt;
    await db.transactions.add({
      id: nanoid(),
      bank,
      importBatchId: 'manual',
      date,
      merchantRaw: merchant.trim(),
      merchantNormalized: merchant.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      amount: actualAmount,
      categoryId: categoryId || null,
      categoryConfidence: categoryId ? 1 : 0,
      categorySource: categoryId ? 'user' : 'uncategorized',
      type,
      dedupeKey: `manual-${nanoid()}`,
      notes: notes.trim() || undefined,
      hidden: false,
    });
    onClose();
  }

  const F: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
  const L: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const sel: React.CSSProperties = { width: '100%', padding: '7px 11px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'color-mix(in oklab, white 60%, transparent)', fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--sans)' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="glass" style={{ padding: 24, maxWidth: 460, width: '90%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20 }}>Add transaction</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={F}>
            <label style={L}>Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={F}>
            <label style={L}>Bank</label>
            <select style={sel} value={bank} onChange={e => setBank(e.target.value as Bank)}>
              <option value="amex">American Express</option>
              <option value="bmo">BMO</option>
              <option value="scotia">Scotiabank</option>
            </select>
          </div>
          <div style={{ ...F, gridColumn: '1 / -1' }}>
            <label style={L}>Merchant / description</label>
            <input className="input" style={{ width: '100%' }} placeholder="e.g. Shoppers Drug Mart" value={merchant} onChange={e => setMerchant(e.target.value)} autoFocus />
          </div>
          <div style={F}>
            <label style={L}>Amount</label>
            <input type="number" className="input" style={{ width: '100%' }} placeholder="0.00" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div style={F}>
            <label style={L}>Type</label>
            <select style={sel} value={type} onChange={e => setType(e.target.value as TxType)}>
              <option value="spend">Spend</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
              <option value="cc-payment">Credit Card Payment</option>
            </select>
          </div>
          <div style={{ ...F, gridColumn: '1 / -1' }}>
            <label style={L}>Category</label>
            <select style={sel} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.filter(c => !c.archived && (type === 'income' ? c.isIncome : !c.isIncome)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ ...F, gridColumn: '1 / -1' }}>
            <label style={L}>Notes (optional)</label>
            <input className="input" style={{ width: '100%' }} placeholder="e.g. Mom's medication pickup" value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} />
          </div>
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            <Icon name="plus" size={13} />Add transaction
          </button>
        </div>
      </div>
    </div>
  );
}
