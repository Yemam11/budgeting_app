import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import { Icon } from '../components/Primitives';
import { InvestmentDetailsDialog } from '../components/InvestmentDetailsDialog';
import type { InvestmentAccount, Holding, Transaction } from '../types';

const SI_ACCOUNTS_DEFAULT: InvestmentAccount[] = [
  { id: 'tfsa', name: 'TFSA', institution: 'Questrade', roomLeft: 47500 },
  { id: 'rrsp', name: 'RRSP', institution: 'Questrade' },
  { id: 'fhsa', name: 'FHSA', institution: 'Questrade', roomLeft: 7400 },
];

const ACCT_PALETTE: Record<string, { bg: string; label: string }> = {
  tfsa: { bg: 'linear-gradient(135deg, oklch(52% 0.18 278), oklch(44% 0.20 265))', label: 'TFSA' },
  rrsp: { bg: 'linear-gradient(135deg, oklch(52% 0.17 198), oklch(44% 0.18 185))', label: 'RRSP' },
  fhsa: { bg: 'linear-gradient(135deg, oklch(54% 0.17 158), oklch(46% 0.18 148))', label: 'FHSA' },
};

// ── Portfolio stat card ───────────────────────────────────────────────
function InvestStatCard({ label, value, sub, icon, color, highlight, editable, isOverridden, onOverride, onReset }: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
  highlight?: boolean;
  editable?: boolean;
  isOverridden?: boolean;
  onOverride?: (val: number) => void;
  onReset?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const startEdit = () => {
    if (!editable) return;
    setDraft(value.replace(/[^0-9.]/g, ''));
    setEditing(true);
  };

  const commitEdit = () => {
    const v = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (!isNaN(v) && v >= 0) onOverride?.(v);
    setEditing(false);
  };

  return (
    <div className="glass" style={{
      padding: '20px 22px',
      background: highlight ? 'color-mix(in oklab, oklch(94% 0.07 165), white 60%)' : undefined,
      borderColor: highlight ? 'color-mix(in oklab, oklch(78% 0.16 165), transparent 55%)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="eyebrow">{label}</div>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `color-mix(in oklab, ${color}, transparent 82%)`,
          border: `1px solid color-mix(in oklab, ${color}, transparent 68%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 18, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>$</span>
          <input
            className="input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 500, width: 140, letterSpacing: '-0.025em' }}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={commitEdit}
          />
        </div>
      ) : (
        <div
          onClick={startEdit}
          title={editable ? 'Click to set a manual override' : undefined}
          style={{
            fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500,
            letterSpacing: '-0.025em', lineHeight: 1.1,
            color: highlight ? color : 'var(--ink)',
            cursor: editable ? 'text' : 'default',
          }}
        >
          {value}
        </div>
      )}
      {isOverridden ? (
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 7, display: 'flex', gap: 4, alignItems: 'center' }}>
          <Icon name="sparkle" size={10} />
          Manual override ·{' '}
          <button onClick={onReset} style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Reset
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 7 }}>{sub}</div>
      )}
    </div>
  );
}

// Deterministic avatar color from ticker string
function tickerAvatarColor(ticker: string) {
  const COLORS = [
    'oklch(52% 0.20 25)',  'oklch(52% 0.20 250)', 'oklch(50% 0.18 145)',
    'oklch(52% 0.20 300)', 'oklch(50% 0.18 60)',  'oklch(50% 0.20 180)',
    'oklch(52% 0.20 330)', 'oklch(50% 0.18 220)',
  ];
  let h = 0;
  for (const c of ticker) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[h % COLORS.length];
}

// ── Holding row ───────────────────────────────────────────────────────
function HoldingRow({ holding, price, accountTotal, isLast, onEdit, onRemove }: {
  holding: Holding;
  price: number | null;
  accountTotal: number;
  isLast: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const value      = price != null ? holding.shares * price : null;
  const allocPct   = value != null && accountTotal > 0 ? (value / accountTotal) * 100 : 0;
  const avatarColor = tickerAvatarColor(holding.ticker);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 72px 110px',
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        background: hovered ? 'color-mix(in oklab, white 48%, transparent)' : 'transparent',
        transition: 'background .1s',
        gap: 8,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Col 1: circular logo + name/ticker stacked */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>

        {/* Circle: logo image or letter avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: logoErr ? avatarColor : 'color-mix(in oklab, var(--ink), transparent 92%)',
        }}>
          {logoErr ? (
            <span style={{ fontWeight: 700, fontSize: 15, color: 'white', fontFamily: 'var(--mono)', userSelect: 'none' }}>
              {holding.ticker[0]}
            </span>
          ) : (
            <img
              src={`/api/logo?ticker=${encodeURIComponent(holding.ticker)}`}
              alt=""
              onError={() => setLogoErr(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        {/* Name + ticker + allocation bar */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {holding.name || holding.ticker}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', marginTop: 2 }}>
            {holding.ticker}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
            <div style={{
              flex: 1, maxWidth: 180, height: 3, borderRadius: 999,
              background: 'color-mix(in oklab, var(--ink), transparent 90%)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${allocPct}%`, borderRadius: 'inherit',
                background: 'var(--accent)', transition: 'width .3s ease',
              }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', flexShrink: 0 }}>
              {allocPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Edit / remove on hover */}
        {hovered && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{
                fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '3px 8px', borderRadius: 5,
                background: 'color-mix(in oklab, var(--accent), transparent 85%)',
                border: '1px solid color-mix(in oklab, var(--accent), transparent 65%)',
                color: 'var(--accent-ink)',
              }}
            >
              Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{ padding: '3px 5px', borderRadius: 5, background: 'color-mix(in oklab, var(--danger), transparent 88%)', border: '1px solid color-mix(in oklab, var(--danger), transparent 72%)', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}
            >
              <Icon name="x" size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Col 2: current price */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, textAlign: 'right', color: 'var(--ink)' }}>
        {price != null ? fmtCAD(price) : '—'}
      </div>

      {/* Col 3: shares */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'right', color: 'var(--ink-soft)' }}>
        {holding.shares % 1 === 0 ? holding.shares.toLocaleString() : holding.shares.toFixed(4)}
      </div>

      {/* Col 4: market value */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, textAlign: 'right', color: 'var(--ink)' }}>
        {value != null ? fmtCAD(value) : '—'}
      </div>
    </div>
  );
}

// ── Investment account card ───────────────────────────────────────────
function InvestAccountCard({ account, holdings, prices, usdConverted, usdcadRate, onUpdateHolding, onRemoveHolding, onRemove, onValueOverride }: {
  account: InvestmentAccount;
  holdings: Holding[];
  prices: Record<string, number | null>;
  usdConverted: string[];
  usdcadRate: number | null;
  onUpdateHolding: (h: Holding) => void;
  onRemoveHolding: (id: string) => void;
  onRemove: () => void;
  onValueOverride: (val: number | null) => void;
}) {
  const [expanded,      setExpanded]      = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editingValue,  setEditingValue]  = useState(false);
  const [valueDraft,    setValueDraft]    = useState('');
  const [tickerQuery, setTickerQuery] = useState('');
  const [formShares,  setFormShares]  = useState('');
  const [formAvgCost, setFormAvgCost] = useState('');
  const [formName,    setFormName]    = useState('');
  const [formTicker,  setFormTicker]  = useState('');
  const [tickerResults,      setTickerResults]      = useState<{ ticker: string; name: string }[]>([]);
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pal = ACCT_PALETTE[account.id] ?? {
    bg: 'linear-gradient(135deg, oklch(48% 0.12 260), oklch(40% 0.10 260))',
    label: account.name.slice(0, 4).toUpperCase(),
  };

  const computedTotal = holdings.reduce((s, h) => {
    const p = prices[h.ticker];
    return s + (p != null ? h.shares * p : 0);
  }, 0);
  const accountTotal   = account.valueOverride ?? computedTotal;
  const accountCost    = holdings.reduce((s, h) => s + h.shares * (h.avgCost ?? 0), 0);
  const accountGain    = accountTotal > 0 && accountCost > 0 ? accountTotal - accountCost : null;
  const accountGainPct = accountGain != null && accountCost > 0 ? (accountGain / accountCost) * 100 : null;
  const isUp           = accountGain != null && accountGain >= 0;
  const gainColor      = isUp ? 'oklch(44% 0.18 160)' : 'var(--danger)';

  const acctUsdConverted = usdConverted.filter(t => holdings.some(h => h.ticker === t));

  function searchTicker(q: string) {
    setTickerQuery(q);
    setFormTicker(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setTickerResults([]); setShowTickerDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setTickerResults(data);
        setShowTickerDropdown(data.length > 0);
      } catch { setTickerResults([]); }
    }, 300);
  }

  function selectTicker(t: { ticker: string; name: string }) {
    setTickerQuery(`${t.ticker} — ${t.name}`);
    setFormTicker(t.ticker);
    setFormName(t.name);
    setShowTickerDropdown(false);
  }

  function openAdd() {
    setEditingId(null);
    setTickerQuery('');
    setFormTicker('');
    setFormName('');
    setFormShares('');
    setFormAvgCost('');
    setShowForm(true);
  }

  function openEdit(h: Holding) {
    setEditingId(h.id);
    setFormTicker(h.ticker);
    setFormName(h.name ?? '');
    setTickerQuery(h.ticker + (h.name ? ` — ${h.name}` : ''));
    setFormShares(String(h.shares));
    setFormAvgCost(h.avgCost != null ? String(h.avgCost) : '');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setTickerQuery('');
    setFormTicker('');
    setFormName('');
    setFormShares('');
    setFormAvgCost('');
    setShowTickerDropdown(false);
  }

  function saveForm() {
    const ticker    = (formTicker || tickerQuery).trim().toUpperCase();
    const sharesNum = parseFloat(formShares);
    const avgCostNum = formAvgCost ? parseFloat(formAvgCost.replace(/[^0-9.]/g, '')) : undefined;
    if (!ticker || !sharesNum || sharesNum <= 0) return;

    const holdingId = editingId ?? `${account.id}__${ticker}`;
    const existing  = holdings.find(h => h.id === (editingId ?? holdingId));

    onUpdateHolding({
      id:        holdingId,
      accountId: account.id,
      ticker,
      name:    formName || existing?.name || '',
      shares:  sharesNum,
      avgCost: avgCostNum ?? existing?.avgCost,
    });
    cancelForm();
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowTickerDropdown(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="glass" style={{ overflow: showForm ? 'visible' : 'hidden' }}>

      {/* Account header — click to expand/collapse */}
      <div
        style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded && (holdings.length > 0 || showForm) ? '1px solid var(--line)' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Account badge */}
        <div style={{
          width: 40, height: 40, borderRadius: 11, background: pal.bg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 11, fontFamily: 'var(--mono)',
          letterSpacing: '-0.03em',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.18)',
        }}>
          {pal.label}
        </div>

        {/* Name + value + gain */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{account.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{account.institution}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {editingValue ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <span style={{ fontSize: 16, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>$</span>
                <input
                  className="input"
                  value={valueDraft}
                  onChange={e => setValueDraft(e.target.value)}
                  autoFocus
                  style={{ fontSize: 18, fontFamily: 'var(--mono)', fontWeight: 500, width: 130, letterSpacing: '-0.022em' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseFloat(valueDraft.replace(/[^0-9.]/g, ''));
                      if (!isNaN(v) && v >= 0) onValueOverride(v);
                      setEditingValue(false);
                    }
                    if (e.key === 'Escape') setEditingValue(false);
                  }}
                  onBlur={() => {
                    const v = parseFloat(valueDraft.replace(/[^0-9.]/g, ''));
                    if (!isNaN(v) && v >= 0) onValueOverride(v);
                    setEditingValue(false);
                  }}
                />
              </div>
            ) : (
              <span
                style={{ fontFamily: 'var(--mono)', fontSize: 21, fontWeight: 500, letterSpacing: '-0.022em', cursor: 'text' }}
                title="Click to override market value"
                onClick={e => { e.stopPropagation(); setValueDraft(accountTotal > 0 ? String(Math.round(accountTotal)) : ''); setEditingValue(true); }}
              >
                {accountTotal > 0 ? fmtCAD(accountTotal) : '—'}
              </span>
            )}
            {account.valueOverride != null && !editingValue && (
              <button
                onClick={e => { e.stopPropagation(); onValueOverride(null); }}
                style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', flexShrink: 0 }}
              >
                Reset
              </button>
            )}
            {accountGain != null && !editingValue && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: gainColor }}>
                {isUp ? '+' : '−'}{fmtCAD(Math.abs(accountGain))}
                {accountGainPct != null && (
                  <span style={{ fontWeight: 400, opacity: 0.72 }}>
                    {' '}({isUp ? '+' : ''}{accountGainPct.toFixed(1)}%)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {account.valueOverride != null && (
          <div style={{ fontSize: 10, color: 'var(--ink-mute)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <Icon name="sparkle" size={9} />
            Manual override · computed {fmtCAD(computedTotal)}
          </div>
        )}

        {/* Contribution room */}
        {account.roomLeft ? (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Contribution room</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)' }}>
              {fmtCAD(account.roomLeft)}
            </div>
          </div>
        ) : <div />}

        {/* Remove + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{ display: 'flex', padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)' }}
          >
            <Icon name="x" size={12} />
          </button>
          <div style={{ color: 'var(--ink-mute)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}>
            <Icon name="chevron_down" size={15} />
          </div>
        </div>
      </div>

      {/* Column headers */}
      {expanded && holdings.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 90px 72px 110px',
          padding: '8px 20px', gap: 8,
          background: 'color-mix(in oklab, var(--ink), transparent 93%)',
          borderBottom: '1px solid var(--line)',
        }}>
          {(['Holding', 'Price', 'Shares', 'Value'] as const).map((col, i) => (
            <div key={col} style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--ink-soft)', textAlign: i === 0 ? 'left' : 'right',
            }}>{col}</div>
          ))}
        </div>
      )}

      {/* Holding rows */}
      {expanded && holdings.map((h, i) => (
        editingId === h.id ? null : (
          <HoldingRow
            key={h.id}
            holding={h}
            price={prices[h.ticker] ?? null}
            accountTotal={accountTotal}
            isLast={i === holdings.length - 1 && !showForm}
            onEdit={() => openEdit(h)}
            onRemove={() => onRemoveHolding(h.id)}
          />
        )
      ))}

      {/* Empty state */}
      {expanded && holdings.length === 0 && !showForm && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
          No holdings recorded for this account.
        </div>
      )}

      {/* Add / Edit form */}
      {expanded && showForm && (
        <div ref={dropdownRef} style={{ padding: '14px 20px', background: 'color-mix(in oklab, white 30%, transparent)', borderTop: holdings.length > 0 ? '1px solid var(--line)' : 'none' }}>
          <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 10, color: 'var(--ink-soft)' }}>
            {editingId ? 'Edit holding' : 'Add holding'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Ticker search */}
            <div style={{ position: 'relative', flex: '2 1 160px', minWidth: 0 }}>
              <input
                className="input"
                placeholder="Search ticker…"
                value={tickerQuery}
                onChange={e => searchTicker(e.target.value)}
                style={{ width: '100%', fontSize: 12 }}
                autoFocus
              />
              {showTickerDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--bg)', border: '1px solid var(--line-strong)',
                  borderRadius: 8, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.30)', overflow: 'hidden',
                }}>
                  {tickerResults.map(r => (
                    <button key={r.ticker}
                      onClick={() => selectTicker(r)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--ink)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, var(--accent), transparent 90%)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, marginRight: 6 }}>{r.ticker}</span>
                      <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              className="input"
              type="number"
              placeholder="Shares"
              value={formShares}
              onChange={e => setFormShares(e.target.value)}
              style={{ fontSize: 12, flex: '1 1 80px', minWidth: 60 }}
            />
            <input
              className="input"
              placeholder="Avg cost/share (CAD)"
              value={formAvgCost}
              onChange={e => setFormAvgCost(e.target.value)}
              style={{ fontSize: 12, flex: '1 1 120px', minWidth: 80 }}
              onKeyDown={e => e.key === 'Enter' && saveForm()}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={saveForm}>
              {editingId ? 'Update' : 'Add'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {/* Footer: add holding button + USD note */}
      {expanded && !showForm && (
        <div style={{
          padding: '10px 20px',
          borderTop: holdings.length > 0 ? '1px solid var(--line)' : 'none',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={openAdd}>
            <Icon name="plus" size={11} />Add holding
          </button>
          {acctUsdConverted.length > 0 && usdcadRate != null && (
            <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
              USD→CAD @ {usdcadRate.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export function InvestmentsPage() {
  const txs         = useQuery(() => db.transactions.toArray(), []) ?? [];
  const holdingsData = useQuery(() => db.holdings.toArray(), []) ?? [];

  const [accounts,            setAccountsRaw]           = useState<InvestmentAccount[]>(SI_ACCOUNTS_DEFAULT);
  const [settingsLoaded,      setSettingsLoaded]         = useState(false);
  const [netDepositsOverride, setNetDepositsOverrideRaw] = useState<number | null>(null);
  const [marketValueOverride, setMarketValueOverrideRaw] = useState<number | null>(null);

  const [prices,        setPrices]        = useState<Record<string, number | null>>({});
  const [usdcadRate,    setUsdcadRate]    = useState<number | null>(null);
  const [usdConverted,  setUsdConverted]  = useState<string[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      db.settings.get('si_accounts'),
      db.settings.get('si_net_deposits_override'),
      db.settings.get('si_market_value_override'),
    ]).then(([acct, nd, mv]) => {
      if (acct) setAccountsRaw(acct.value as InvestmentAccount[]);
      setNetDepositsOverrideRaw(nd ? (nd.value as number | null) : null);
      setMarketValueOverrideRaw(mv ? (mv.value as number | null) : null);
      setSettingsLoaded(true);
    });
  }, []);

  function setNetDepositsOverride(val: number | null) {
    setNetDepositsOverrideRaw(val);
    db.settings.put({ key: 'si_net_deposits_override', value: val });
  }

  function setMarketValueOverride(val: number | null) {
    setMarketValueOverrideRaw(val);
    db.settings.put({ key: 'si_market_value_override', value: val });
  }

  const tickerKey = holdingsData.map(h => h.ticker).sort().join(',');

  function applyPriceResponse(data: { prices?: Record<string, number | null>; usdcad?: number | null; converted?: string[] }) {
    setPrices(data.prices ?? {});
    setUsdcadRate(data.usdcad ?? null);
    setUsdConverted(data.converted ?? []);
  }

  useEffect(() => {
    if (!tickerKey) return;
    setPricesLoading(true);
    fetch(`/api/prices?tickers=${encodeURIComponent(tickerKey)}`)
      .then(r => r.json())
      .then(data => { applyPriceResponse(data); setPricesLoading(false); })
      .catch(() => setPricesLoading(false));
  }, [tickerKey]);

  function refreshPrices() {
    if (!tickerKey) return;
    setPricesLoading(true);
    fetch(`/api/prices?tickers=${encodeURIComponent(tickerKey)}`)
      .then(r => r.json())
      .then(data => { applyPriceResponse(data); setPricesLoading(false); })
      .catch(() => setPricesLoading(false));
  }

  function setAccounts(next: InvestmentAccount[]) {
    setAccountsRaw(next);
    db.settings.put({ key: 'si_accounts', value: next });
  }

  const investTxsAll = useMemo(() =>
    txs.filter(t => t.type === 'investment' && !t.hidden)
       .sort((a, b) => b.date.localeCompare(a.date)),
  [txs]);

  const totalNetDeposits = useMemo(() =>
    accounts.reduce((s, a) =>
      s + investTxsAll.filter(t => t.investmentAccount === a.id).reduce((as, t) => as + t.amount, 0),
    0),
  [accounts, investTxsAll]);

  const totalMarketValue = useMemo(() =>
    accounts.reduce((sum, a) => {
      if (a.valueOverride != null) return sum + a.valueOverride;
      return sum + holdingsData
        .filter(h => h.accountId === a.id)
        .reduce((s, h) => {
          const p = prices[h.ticker];
          return s + (p != null ? h.shares * p : 0);
        }, 0);
    }, 0),
  [accounts, holdingsData, prices]);

  const totalCostBasis = useMemo(() =>
    holdingsData.reduce((s, h) => s + h.shares * (h.avgCost ?? 0), 0),
  [holdingsData]);

  const displayNetDeposits = netDepositsOverride ?? totalNetDeposits;
  const displayMarketValue = marketValueOverride ?? totalMarketValue;

  const totalPortfolioGain    = displayMarketValue - displayNetDeposits;
  const totalPortfolioGainPct = displayNetDeposits > 0 ? (totalPortfolioGain / displayNetDeposits) * 100 : 0;
  const gainPositive          = totalPortfolioGain >= 0;
  const gainColor             = gainPositive ? 'oklch(44% 0.18 160)' : 'var(--danger)';

  const [showAddAccount,        setShowAddAccount]        = useState(false);
  const [newAccountName,        setNewAccountName]        = useState('');
  const [newAccountInstitution, setNewAccountInstitution] = useState('');
  const [editDialogTx,          setEditDialogTx]          = useState<Transaction | null>(null);

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    setAccounts([...accounts, {
      id:          'acct-' + Date.now(),
      name:        newAccountName.trim().toUpperCase(),
      institution: newAccountInstitution.trim(),
    }]);
    setNewAccountName('');
    setNewAccountInstitution('');
    setShowAddAccount(false);
  };

  const removeAccount = (id: string) => setAccounts(accounts.filter(a => a.id !== id));

  if (!settingsLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-mute)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040 }}>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Wealth</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Investments</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 560 }}>
              Track your investment accounts, holdings, and portfolio performance.
            </div>
          </div>
          {holdingsData.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12, flexShrink: 0, marginTop: 4 }} onClick={refreshPrices} disabled={pricesLoading}>
              <Icon name={pricesLoading ? 'sparkle' : 'refresh'} size={12} />
              {pricesLoading ? 'Refreshing…' : 'Refresh prices'}
            </button>
          )}
        </div>
      </div>

      {/* ── Portfolio summary — 3 stat cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <InvestStatCard
          label="Net Deposits"
          value={fmtCAD(displayNetDeposits)}
          sub={`${investTxsAll.length} contribution${investTxsAll.length !== 1 ? 's' : ''} recorded`}
          icon="download"
          color="var(--ink-soft)"
          editable
          isOverridden={netDepositsOverride !== null}
          onOverride={setNetDepositsOverride}
          onReset={() => setNetDepositsOverride(null)}
        />
        <InvestStatCard
          label="Approx. Market Value"
          value={fmtCAD(displayMarketValue)}
          sub={`${holdingsData.length} holding${holdingsData.length !== 1 ? 's' : ''} across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
          icon="chart_line"
          color="oklch(52% 0.18 278)"
          editable
          isOverridden={marketValueOverride !== null}
          onOverride={setMarketValueOverride}
          onReset={() => setMarketValueOverride(null)}
        />
        <InvestStatCard
          label="Total Gains"
          value={`${gainPositive ? '+' : '−'}${fmtCAD(Math.abs(totalPortfolioGain))}`}
          sub={`${totalPortfolioGainPct >= 0 ? '▲' : '▼'} ${Math.abs(totalPortfolioGainPct).toFixed(2)}% all-time return`}
          icon="arrow_up_right"
          color={gainColor}
          highlight={gainPositive && displayNetDeposits > 0}
        />
      </div>

      {/* ── Account cards header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
          Click an account to expand or collapse its holdings.
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowAddAccount(s => !s)}>
          <Icon name="plus" size={12} />Add account
        </button>
      </div>

      {/* ── Account cards — stacked full-width ────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {accounts.map(a => (
          <InvestAccountCard
            key={a.id}
            account={a}
            holdings={holdingsData.filter(h => h.accountId === a.id)}
            prices={prices}
            usdConverted={usdConverted}
            usdcadRate={usdcadRate}
            onUpdateHolding={h => db.holdings.put(h)}
            onRemoveHolding={id => db.holdings.delete(id)}
            onRemove={() => removeAccount(a.id)}
            onValueOverride={val => setAccounts(accounts.map(ac =>
              ac.id === a.id ? { ...ac, valueOverride: val ?? undefined } : ac
            ))}
          />
        ))}

        {accounts.length === 0 && !showAddAccount && (
          <div className="glass" style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)' }}>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              No investment accounts. Add your TFSA, RRSP, or any other account.
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddAccount(true)}>
              <Icon name="plus" size={12} />Add account
            </button>
          </div>
        )}

        {showAddAccount && (
          <div className="glass" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>New account</div>
            <input className="input" placeholder="Account name (e.g. TFSA)" value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)} style={{ fontSize: 12 }} autoFocus />
            <input className="input" placeholder="Institution (e.g. Questrade)" value={newAccountInstitution}
              onChange={e => setNewAccountInstitution(e.target.value)} style={{ fontSize: 12 }}
              onKeyDown={e => e.key === 'Enter' && addAccount()} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={addAccount}>Add</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setShowAddAccount(false); setNewAccountName(''); setNewAccountInstitution(''); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Investment history table ───────────────────────────────── */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Investment history</div>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Investment-tagged transfers · all time</span>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ width: 80 }}>Account</th>
              <th>Description</th>
              <th style={{ textAlign: 'right', width: 130 }}>Amount deposited</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {investTxsAll.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-mute)', fontSize: 13 }}>
                  No investment transactions yet. Tag transfers with the "Investment" category and set the account field.
                </td>
              </tr>
            ) : investTxsAll.map(t => {
              const ACCT_COLOR: Record<string, string> = {
                tfsa: 'oklch(52% 0.18 278)',
                rrsp: 'oklch(52% 0.17 198)',
                fhsa: 'oklch(54% 0.17 158)',
              };
              const ac = ACCT_COLOR[t.investmentAccount ?? ''] ?? 'var(--ink-soft)';
              return (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)' }}>{t.date}</td>
                  <td>
                    <span className="chip" style={{
                      background: `color-mix(in oklab, ${ac}, transparent 86%)`,
                      borderColor: `color-mix(in oklab, ${ac}, transparent 68%)`,
                      color: `color-mix(in oklab, ${ac}, black 22%)`,
                    }}>
                      {(t.investmentAccount ?? '').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{t.merchantRaw}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500, fontFamily: 'var(--mono)', color: 'oklch(48% 0.17 165)' }}>
                    +{fmtCAD(t.amount)}
                  </td>
                  <td style={{ width: 60 }}>
                    {t.holdingLogged && (
                      <button
                        onClick={() => setEditDialogTx(t)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
                          background: 'none', border: '1px solid var(--line-strong)',
                          color: 'var(--ink-mute)', cursor: 'pointer',
                        }}
                      >
                        <Icon name="edit" size={9} />Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editDialogTx && (
        <InvestmentDetailsDialog
          tx={editDialogTx}
          pendingTxs={[]}
          isEdit
          onClose={() => setEditDialogTx(null)}
          onNext={() => setEditDialogTx(null)}
        />
      )}
    </div>
  );
}
