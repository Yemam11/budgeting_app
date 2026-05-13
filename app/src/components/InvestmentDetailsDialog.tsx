import { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import type { Transaction, InvestmentAccount, Holding } from '../types';
import { fmtCAD } from '../lib/money';
import { Icon } from './Primitives';

interface TickerResult { ticker: string; name: string }

interface HoldingRow {
  key: string;
  tickerQuery: string;
  tickerValue: string;
  shares: string;
}

interface Props {
  tx: Transaction;
  pendingTxs: Transaction[];
  onClose: () => void;
  onNext: (next: Transaction | null) => void;
  isEdit?: boolean;
}

export function InvestmentDetailsDialog({ tx, pendingTxs, onClose, onNext, isEdit }: Props) {
  const [accounts,      setAccounts]      = useState<InvestmentAccount[]>([]);
  const [accountId,     setAccountId]     = useState(tx.investmentAccount ?? '');
  const [rows,          setRows]          = useState<HoldingRow[]>([
    { key: '1', tickerQuery: '', tickerValue: '', shares: '' },
  ]);
  const [activeKey,     setActiveKey]     = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<TickerResult[]>([]);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const searchTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);

  const currentIndex = pendingTxs.findIndex(t => t.id === tx.id);
  const isPending    = pendingTxs.some(t => t.id === tx.id);
  const totalPending = pendingTxs.length;

  useEffect(() => {
    db.settings.get('si_accounts').then(r => {
      if (r) setAccounts(r.value as InvestmentAccount[]);
    });
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (rowsContainerRef.current && !rowsContainerRef.current.contains(e.target as Node))
        setActiveKey(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function updateRow(key: string, patch: Partial<HoldingRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  }

  function handleTickerInput(key: string, val: string) {
    updateRow(key, { tickerQuery: val, tickerValue: '' });
    setActiveKey(val.trim() ? key : null);
    setSearchResults([]);
    if (!val.trim()) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ticker-search?q=${encodeURIComponent(val)}`);
        const data: TickerResult[] = await r.json();
        setSearchResults(data);
        if (data.length === 0) setActiveKey(null);
      } catch { setSearchResults([]); }
    }, 300);
  }

  function selectTicker(key: string, t: TickerResult) {
    updateRow(key, { tickerValue: t.ticker, tickerQuery: `${t.ticker} — ${t.name}` });
    setActiveKey(null);
  }

  function addRow() {
    setRows(prev => [...prev, { key: String(Date.now()), tickerQuery: '', tickerValue: '', shares: '' }]);
  }

  function removeRow(key: string) {
    setRows(prev => prev.filter(r => r.key !== key));
  }

  async function submit() {
    if (!accountId) { setError('Select an account.'); return; }

    setBusy(true);
    setError(null);

    if (isEdit) {
      try {
        await db.transactions.update(tx.id, { investmentAccount: accountId });
        onClose();
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
      return;
    }

    const valid = rows
      .map(r => ({ ticker: (r.tickerValue || r.tickerQuery).trim().toUpperCase(), shares: parseFloat(r.shares) }))
      .filter(r => r.ticker && r.shares > 0);
    if (!valid.length) { setError('Enter at least one ticker and share count.'); setBusy(false); return; }

    try {
      await db.transactions.update(tx.id, { investmentAccount: accountId, holdingLogged: true });
      await Promise.all(valid.map(async ({ ticker, shares }) => {
        const holdingId = `${accountId}__${ticker}`;
        const existing = await db.holdings.get(holdingId);
        await db.holdings.put({ id: holdingId, accountId, ticker, shares: (existing?.shares ?? 0) + shares } as Holding);
      }));
      advance();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function skip() {
    await db.transactions.update(tx.id, { holdingLogged: true });
    advance();
  }

  function advance() {
    const remaining = pendingTxs.filter(t => t.id !== tx.id);
    onNext(remaining[0] ?? null);
  }

  const totalPendingAfterThis = isPending ? totalPending - 1 : totalPending;

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
    background: 'var(--popover-solid-bg, var(--bg))',
    border: '1px solid var(--line-strong)',
    borderRadius: 8, marginTop: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.30)',
    overflow: 'hidden',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.52)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="glass"
        style={{ width: '100%', maxWidth: 520, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {isEdit ? 'Edit Investment' : 'Investment Purchase'}
              </div>
              {!isEdit && isPending && totalPending > 1 && (
                <span className="chip" style={{ fontSize: 10 }}>{currentIndex + 1} of {totalPending}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {tx.merchantRaw} · <span style={{ fontFamily: 'var(--mono)' }}>{fmtCAD(tx.amount)}</span> · {tx.date}
            </div>
          </div>
          <button onClick={onClose}
            style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Account */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Account</div>
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)} style={{ width: '100%', fontSize: 13 }}>
            <option value="">Select account…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.institution}</option>)}
          </select>
        </div>

        {/* Holdings — hidden in edit mode */}
        {isEdit ? (
          <div style={{
            fontSize: 12, color: 'var(--ink-soft)',
            padding: '10px 14px', borderRadius: 8,
            background: 'color-mix(in oklab, var(--accent), transparent 92%)',
            border: '1px solid color-mix(in oklab, var(--accent), transparent 72%)',
          }}>
            Share counts are already recorded. Use the <strong>Edit shares</strong> button on the account card to adjust individual holdings.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="eyebrow">Holdings purchased</div>
              <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>One row per security</div>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 24px', gap: 6, marginBottom: 4, paddingRight: rows.length > 1 ? 0 : 30 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)', paddingLeft: 2 }}>Ticker / Security</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)', paddingLeft: 2 }}>Shares</div>
            </div>

            <div ref={rowsContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((row, i) => (
                <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 24px', gap: 6, alignItems: 'start' }}>
                  {/* Ticker search */}
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      placeholder="Search ticker…"
                      value={row.tickerQuery}
                      onChange={e => handleTickerInput(row.key, e.target.value)}
                      onFocus={() => { if (searchResults.length > 0 && row.tickerQuery.trim()) setActiveKey(row.key); }}
                      style={{ width: '100%', fontSize: 13 }}
                      autoComplete="off"
                      autoFocus={i === 0}
                    />
                    {activeKey === row.key && searchResults.length > 0 && (
                      <div style={dropdownStyle}>
                        {searchResults.map(r => (
                          <button key={r.ticker} onClick={() => selectTicker(row.key, r)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              borderBottom: '1px solid var(--line)', fontSize: 13, color: 'var(--ink)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, var(--accent), transparent 90%)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, marginRight: 8, color: 'var(--ink)' }}>{r.ticker}</span>
                            <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{r.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shares */}
                  <input
                    className="input"
                    type="number"
                    placeholder="0"
                    value={row.shares}
                    onChange={e => updateRow(row.key, { shares: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    style={{ width: '100%', fontSize: 13 }}
                    min="0"
                    step="any"
                  />

                  {/* Remove */}
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}>
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(row.key)}
                        style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', lineHeight: 1 }}>
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 10 }} onClick={addRow}>
              <Icon name="plus" size={11} />Add another holding
            </button>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', padding: '7px 10px', background: 'color-mix(in oklab, var(--danger), transparent 88%)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--line)' }}>
          {isEdit ? (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onClose} disabled={busy}>
              Cancel
            </button>
          ) : (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={skip} disabled={busy}>
              Skip{isPending && totalPendingAfterThis > 0 && ` (${totalPendingAfterThis} remaining)`}
            </button>
          )}
          <button className="btn btn-primary" style={{ fontSize: 13, minWidth: 120 }} onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
