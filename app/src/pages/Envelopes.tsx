import { useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import { Icon, CatSwatch } from '../components/Primitives';
import type { Category, Envelope, Transaction } from '../types';

const PALETTE = [
  'oklch(62% 0.18 25)',
  'oklch(62% 0.18 55)',
  'oklch(62% 0.18 140)',
  'oklch(62% 0.18 200)',
  'oklch(62% 0.18 255)',
  'oklch(62% 0.18 290)',
  'oklch(62% 0.18 320)',
  'oklch(55% 0.10 260)',
];

// ---- Create / Edit Dialog ----

function EnvelopeDialog({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Envelope>;
  onSave: (e: Omit<Envelope, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? PALETTE[4]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, description: description.trim() || undefined, color });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,12,18,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" style={{ padding: '28px 24px', width: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {initial?.id ? 'Edit envelope' : 'New envelope'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 500 }}>Name</label>
          <input
            className="input"
            placeholder="e.g. Summer trip, Groceries"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            autoFocus
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 500 }}>Description (optional)</label>
          <input
            className="input"
            placeholder="What is this envelope for?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-mute)', fontWeight: 500 }}>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
                  outline: color === c ? `3px solid ${c}` : '3px solid transparent',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
            {initial?.id ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add Transactions Dialog ----

function AddTransactionsDialog({
  envelopeId,
  allTxs,
  onClose,
}: {
  envelopeId: string;
  allTxs: Transaction[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const eligible = useMemo(() =>
    allTxs
      .filter(t => t.type === 'spend' || t.type === 'income')
      .filter(t => !t.hidden)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allTxs]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return eligible;
    return eligible.filter(t =>
      t.merchantRaw.toLowerCase().includes(q) ||
      t.date.includes(q)
    );
  }, [eligible, search]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    await Promise.all(
      [...selected].map(id => db.transactions.update(id, { envelopeId }))
    );
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,12,18,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" style={{ width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Add transactions</div>
          <input
            className="input"
            placeholder="Search merchant or date…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%' }}
            autoFocus
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>No transactions found</div>
          ) : (
            <table className="data" style={{ width: '100%' }}>
              <tbody>
                {filtered.map(t => {
                  const inThisEnvelope = t.envelopeId === envelopeId;
                  const inOther = t.envelopeId && t.envelopeId !== envelopeId;
                  const isChecked = selected.has(t.id) || inThisEnvelope;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => { if (!inThisEnvelope) toggle(t.id); }}
                      style={{ cursor: inThisEnvelope ? 'default' : 'pointer', opacity: inOther ? 0.45 : 1 }}
                    >
                      <td style={{ width: 32, paddingRight: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          disabled={inThisEnvelope}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {t.merchantRaw}
                        {inThisEnvelope && <span style={{ fontSize: 10, color: 'var(--ink-mute)', marginLeft: 6 }}>already here</span>}
                        {inOther && <span style={{ fontSize: 10, color: 'var(--ink-mute)', marginLeft: 6 }}>in another envelope</span>}
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>{t.date}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {fmtCAD(Math.abs(t.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {selected.size > 0 ? `${selected.size} selected` : 'Select transactions to add'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={add} disabled={selected.size === 0}>
              Add {selected.size > 0 ? `${selected.size} ` : ''}transaction{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- KPI helpers ----

interface KPI {
  id: string;
  name: string;
  color: string;
  amount: number;
  count: number;
  pct: number;
}

function computeDateRange(txs: Transaction[]): string {
  if (!txs.length) return '';
  const dates = txs.map(t => t.date).sort();
  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const from = dates[0];
  const to = dates[dates.length - 1];
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function KpiCard({ kpi, rank }: { kpi: KPI; rank: number }) {
  const isTop = rank === 0;
  return (
    <div style={{
      position: 'relative',
      padding: '20px 22px',
      borderRadius: 18,
      background: isTop
        ? `linear-gradient(135deg, color-mix(in oklab, ${kpi.color}, white 72%), color-mix(in oklab, ${kpi.color}, white 85%))`
        : 'var(--glass-bg)',
      backdropFilter: 'blur(18px) saturate(140%)',
      WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      border: `1px solid ${isTop ? `color-mix(in oklab, ${kpi.color}, transparent 55%)` : 'var(--glass-border)'}`,
      boxShadow: isTop
        ? `var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px color-mix(in oklab, ${kpi.color}, transparent 70%)`
        : 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.6)',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpi.color, borderRadius: '18px 18px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in oklab, ${kpi.color}, transparent 72%)`, border: `1px solid color-mix(in oklab, ${kpi.color}, transparent 55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CatSwatch color={kpi.color} size={9} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>{kpi.name}</div>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', background: 'color-mix(in oklab, white 60%, transparent)', padding: '2px 7px', borderRadius: 999, border: '1px solid var(--line)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {kpi.count} txn{kpi.count !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, color: 'var(--ink)' }}>
          {fmtCAD(kpi.amount)}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Share of total</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 500, color: `color-mix(in oklab, ${kpi.color}, black 15%)` }}>{kpi.pct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'color-mix(in oklab, var(--ink), transparent 91%)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${kpi.pct}%`, background: kpi.color, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

// ---- Envelope Detail View ----

function EnvelopeDetail({
  envelope,
  allTxs,
  categories,
  onBack,
  onEdit,
  onDelete,
}: {
  envelope: Envelope;
  allTxs: Transaction[];
  categories: Category[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const deletingNoteRef = useRef(false);

  const outstandingEntries = useQuery(() => db.outstanding.where('status').notEqual('settled').toArray(), []) ?? [];
  const owedTxIds = useMemo(() => new Set(outstandingEntries.map(e => e.transactionId)), [outstandingEntries]);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const txs = useMemo(() =>
    allTxs
      .filter(t => t.envelopeId === envelope.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allTxs, envelope.id]
  );

  const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);

  const kpis = useMemo<KPI[]>(() => {
    const map = new Map<string, { amount: number; count: number; name: string; color: string }>();
    for (const t of txs) {
      const key = t.categoryId ?? '__uncategorized__';
      const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
      if (!map.has(key)) {
        map.set(key, { amount: 0, count: 0, name: cat?.name ?? 'Uncategorized', color: cat?.color ?? 'oklch(65% 0.02 260)' });
      }
      const entry = map.get(key)!;
      entry.amount += Math.abs(t.amount);
      entry.count += 1;
    }
    const denom = total || 1;
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v, pct: (v.amount / denom) * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [txs, catMap, total]);

  const dateRange = computeDateRange(txs);
  const cols = kpis.length <= 3 ? Math.max(kpis.length, 1) : kpis.length === 4 ? 4 : kpis.length <= 6 ? 3 : 4;

  async function remove(txId: string) {
    await db.transactions.update(txId, { envelopeId: null });
  }

  async function handleCategoryChange(txId: string, catId: string | null) {
    await db.transactions.update(txId, { categoryId: catId });
  }

  async function handleSaveNote(txId: string, note: string) {
    await db.transactions.update(txId, { notes: note.trim() || undefined });
    setEditingNoteId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '6px 10px', fontSize: 12 }}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chevron_right" size={12} /></span>
          Back
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onEdit}>
            <Icon name="edit" size={13} />Edit
          </button>
          <button
            className="btn"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid color-mix(in oklab, var(--danger), transparent 70%)', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={onDelete}
          >
            <Icon name="trash" size={13} />Delete
          </button>
        </div>
      </div>

      {/* Hero band */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, oklch(20% 0.015 260), oklch(15% 0.02 260))',
        borderRadius: 22, padding: '24px 28px', color: 'white', overflow: 'hidden',
        boxShadow: '0 20px 40px -20px oklch(15% 0.05 260 / 0.5), inset 0 1px 0 oklch(100% 0 0 / 0.08)',
        border: '1px solid oklch(30% 0.02 260)',
      }}>
        <div className="hero-pattern" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, background: envelope.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'white',
          }}>
            <Icon name="envelope" size={22} stroke={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{envelope.name}</div>
            <div style={{ fontSize: 13, color: 'oklch(72% 0.02 260)', marginTop: 4 }}>
              {[envelope.description, dateRange].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(65% 0.02 260)', marginBottom: 6, fontWeight: 500 }}>Total</div>
            <div className="mono" style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtCAD(total)}</div>
            <div style={{ fontSize: 12, color: 'oklch(65% 0.02 260)', marginTop: 5 }}>
              {txs.length} transaction{txs.length !== 1 ? 's' : ''} · {kpis.length} categor{kpis.length !== 1 ? 'ies' : 'y'}
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      {kpis.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Breakdown by category</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{kpis.length} {kpis.length === 1 ? 'category' : 'categories'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
            {kpis.map((kpi, i) => <KpiCard key={kpi.id} kpi={kpi} rank={i} />)}
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Transactions</div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={13} />Add transactions
          </button>
        </div>

        {txs.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
            No transactions yet. Click "Add transactions" to add some.
          </div>
        ) : (
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Merchant</th>
                <th style={{ width: 160 }}>Category</th>
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {txs.map(t => {
                const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
                const isIncome = t.amount < 0;
                const isEditingNote = editingNoteId === t.id;
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{t.merchantRaw}</span>
                        {owedTxIds.has(t.id) && <span className="chip chip-accent" style={{ fontSize: 10, padding: '1px 6px' }}>Owed</span>}
                      </div>
                      {t.split && (
                        <div style={{ fontSize: 11, color: 'oklch(58% 0.1 75)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="split" size={10} />Split {t.split.people} ways · {fmtCAD(t.split.myShare)} mine
                        </div>
                      )}
                      {t.spreadMonths && t.spreadMonths > 1 && (
                        <div style={{ fontSize: 11, color: 'oklch(55% 0.12 220)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="calendar" size={10} />Spread {t.spreadMonths} months · {fmtCAD(Math.abs(t.amount) / t.spreadMonths)}/mo
                        </div>
                      )}
                      {isEditingNote ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <input
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            onBlur={() => {
                              if (deletingNoteRef.current) { deletingNoteRef.current = false; return; }
                              handleSaveNote(t.id, noteValue);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveNote(t.id, noteValue);
                              if (e.key === 'Escape') { setEditingNoteId(null); setNoteValue(''); }
                            }}
                            placeholder="Add a note…"
                            autoFocus
                            className="input"
                            style={{ fontSize: 11, padding: '3px 8px', flex: 1, maxWidth: 240 }}
                          />
                          {t.notes && (
                            <button
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 7px', borderRadius: 5, border: 'none', background: 'oklch(50% 0.01 260 / 0.07)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                              onMouseDown={() => { deletingNoteRef.current = true; }}
                              onClick={() => { setEditingNoteId(null); setNoteValue(''); handleSaveNote(t.id, ''); }}
                            >
                              <Icon name="x" size={9} />Delete
                            </button>
                          )}
                        </div>
                      ) : t.notes ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <div
                            style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', cursor: 'pointer' }}
                            onClick={() => { setEditingNoteId(t.id); setNoteValue(t.notes ?? ''); }}
                          >
                            "{t.notes}"
                          </div>
                          <button
                            style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, padding: '1px 4px', borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}
                            onClick={() => handleSaveNote(t.id, '')}
                          >
                            <Icon name="x" size={9} />
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{ fontSize: 11, color: 'var(--ink-mute)', cursor: 'pointer', marginTop: 2, opacity: 0 }}
                          className="note-add-hint"
                          onClick={() => { setEditingNoteId(t.id); setNoteValue(''); }}
                        >
                          + note
                        </div>
                      )}
                    </td>
                    <td>
                      {t.type === 'spend' || t.type === 'income' ? (
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <span className="chip" style={cat ? { background: `color-mix(in oklab, ${cat.color}, transparent 86%)`, borderColor: `color-mix(in oklab, ${cat.color}, transparent 70%)`, color: `color-mix(in oklab, ${cat.color}, black 20%)` } : { color: 'var(--ink-mute)' }}>
                            {cat && <CatSwatch color={cat.color} size={6} />}
                            {cat?.name ?? 'Uncategorized'}
                            <Icon name="chevron_down" size={10} />
                          </span>
                          <select
                            value={t.categoryId ?? ''}
                            onChange={e => handleCategoryChange(t.id, e.target.value || null)}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                          >
                            <option value="">Uncategorized</option>
                            {categories.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      ) : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{t.date}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 500, color: isIncome ? 'oklch(50% 0.15 160)' : 'var(--ink)' }}>
                      {isIncome ? '+' : ''}{fmtCAD(Math.abs(t.amount))}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: 'var(--ink-mute)' }}
                        onClick={() => remove(t.id)}
                        title="Remove from envelope"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddTransactionsDialog
          envelopeId={envelope.id}
          allTxs={allTxs}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ---- Main Envelopes Page ----

export function EnvelopesPage() {
  const envelopes = useQuery(() => db.envelopes.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const allTxs = useQuery(() => db.transactions.toArray(), []) ?? [];
  const categories = useQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);

  const txsByEnvelope = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of allTxs) {
      if (!t.envelopeId) continue;
      const arr = m.get(t.envelopeId) ?? [];
      arr.push(t);
      m.set(t.envelopeId, arr);
    }
    return m;
  }, [allTxs]);

  const selectedEnvelope = envelopes.find(e => e.id === selectedId) ?? null;

  async function createEnvelope(data: Omit<Envelope, 'id' | 'createdAt'>) {
    const id = nanoid();
    await db.envelopes.add({ id, createdAt: Date.now(), ...data });
    setShowCreate(false);
    setSelectedId(id);
  }

  async function updateEnvelope(data: Omit<Envelope, 'id' | 'createdAt'>) {
    if (!editingEnvelope) return;
    await db.envelopes.update(editingEnvelope.id, data);
    setEditingEnvelope(null);
  }

  async function deleteEnvelope(env: Envelope) {
    if (!window.confirm(`Delete envelope "${env.name}"? Transactions will not be deleted, just unlinked.`)) return;
    const txsInEnv = txsByEnvelope.get(env.id) ?? [];
    await Promise.all(txsInEnv.map(t => db.transactions.update(t.id, { envelopeId: null })));
    await db.envelopes.delete(env.id);
    setSelectedId(null);
  }

  if (selectedEnvelope) {
    return (
      <>
        <EnvelopeDetail
          envelope={selectedEnvelope}
          allTxs={allTxs}
          categories={categories}
          onBack={() => setSelectedId(null)}
          onEdit={() => setEditingEnvelope(selectedEnvelope)}
          onDelete={() => deleteEnvelope(selectedEnvelope)}
        />
        {editingEnvelope && (
          <EnvelopeDialog
            initial={editingEnvelope}
            onSave={updateEnvelope}
            onClose={() => setEditingEnvelope(null)}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Budgeting</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Envelopes</div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4, maxWidth: 580 }}>
            Group transactions into envelopes to track spending for trips, events, or any purpose.
          </div>
        </div>
        <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={14} />New envelope
        </button>
      </div>

      {/* Grid */}
      {envelopes.length === 0 ? (
        <div className="glass" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--ink-mute)' }}>
            <Icon name="envelope" size={32} stroke={1} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No envelopes yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 20 }}>
            Create one to group transactions for a trip, project, or event.
          </div>
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} />Create first envelope
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {envelopes.map(env => {
            const txs = txsByEnvelope.get(env.id) ?? [];
            const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
            return (
              <button
                key={env.id}
                onClick={() => setSelectedId(env.id)}
                style={{
                  background: 'color-mix(in oklab, white 70%, transparent)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s, transform 0.1s',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = ''; (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
              >
                {/* Color band */}
                <div style={{ height: 6, background: env.color }} />
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: env.color, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 2px 6px ${env.color}55`, color: 'white',
                    }}>
                      <Icon name="envelope" size={16} stroke={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</div>
                      {env.description && (
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 4 }}>
                    {fmtCAD(total)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                    {txs.length} {txs.length === 1 ? 'transaction' : 'transactions'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <EnvelopeDialog
          onSave={createEnvelope}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
