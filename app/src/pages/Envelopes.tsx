import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import { Icon } from '../components/Primitives';
import type { Envelope, Transaction } from '../types';

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

// ---- Envelope Detail View ----

function EnvelopeDetail({
  envelope,
  allTxs,
  onBack,
  onEdit,
  onDelete,
}: {
  envelope: Envelope;
  allTxs: Transaction[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  const txs = useMemo(() =>
    allTxs
      .filter(t => t.envelopeId === envelope.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allTxs, envelope.id]
  );

  const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);

  async function remove(txId: string) {
    await db.transactions.update(txId, { envelopeId: null });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '6px 10px' }}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chevron_right" size={14} /></span>
          Back
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: envelope.color, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 8px ${envelope.color}55`, color: 'white',
          }}>
            <Icon name="envelope" size={20} stroke={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{envelope.name}</div>
            {envelope.description && (
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 2 }}>{envelope.description}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onEdit}>
            <Icon name="edit" size={13} />Edit
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
            onClick={onDelete}
          >
            <Icon name="trash" size={13} />Delete
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="glass" style={{ padding: 20, display: 'flex', gap: 32, alignItems: 'baseline' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Total</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em' }}>{fmtCAD(total)}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
          {txs.length} {txs.length === 1 ? 'transaction' : 'transactions'}
        </div>
      </div>

      {/* Transactions */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Transactions</div>
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
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {txs.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.merchantRaw}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{t.date}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCAD(Math.abs(t.amount))}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '3px 8px', color: 'var(--ink-mute)' }}
                      onClick={() => remove(t.id)}
                      title="Remove from envelope"
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </td>
                </tr>
              ))}
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
