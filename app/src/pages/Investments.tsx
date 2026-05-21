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

// ── InvestAccountCard ─────────────────────────────────────────────
function InvestAccountCard({
  account, holdings, prices, usdConverted, usdcadRate, effectiveMV, computedMVVal, netDepositsEffective, netDepositsRaw,
  hasNdOverride, hasMVOverride, sharesOverrides,
  onUpdateND, onResetND, onUpdateMV, onResetMV,
  onUpdateHolding, onRemoveHolding,
  onUpdateShares, onResetShares,
  onRemove,
}: {
  account: InvestmentAccount;
  holdings: Holding[];
  prices: Record<string, number | null>;
  usdConverted: string[];
  usdcadRate: number | null;
  effectiveMV: number;
  computedMVVal: number;
  netDepositsEffective: number;
  netDepositsRaw: number;
  hasNdOverride: boolean;
  hasMVOverride: boolean;
  sharesOverrides: Record<string, { value: number; base: number }>;
  onUpdateND: (val: number, base: number) => void;
  onResetND: () => void;
  onUpdateMV: (val: number) => void;
  onResetMV: () => void;
  onUpdateHolding: (h: Holding) => void;
  onRemoveHolding: (id: string) => void;
  onUpdateShares: (holdingId: string, val: number, base: number) => void;
  onResetShares: (holdingId: string) => void;
  onRemove: () => void;
}) {
  const [editND,  setEditND]  = useState(false);
  const [ndDraft, setNDDraft] = useState('');
  const [editMV,  setEditMV]  = useState(false);
  const [mvDraft, setMVDraft] = useState('');

  const [editSharesId,  setEditSharesId]  = useState<string | null>(null);
  const [sharesDraft,   setSharesDraft]   = useState('');

  const [addingHolding,     setAddingHolding]     = useState(false);
  const [addTickerQuery,    setAddTickerQuery]     = useState('');
  const [addTickerValue,    setAddTickerValue]     = useState('');
  const [addTickerResults,  setAddTickerResults]   = useState<{ ticker: string; name: string }[]>([]);
  const [addTickerDropdown, setAddTickerDropdown]  = useState(false);
  const [addShares,         setAddShares]          = useState('');
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PALETTE: Record<string, { bg: string; label: string }> = {
    tfsa: { bg: 'linear-gradient(135deg, oklch(52% 0.18 278), oklch(44% 0.20 265))', label: 'TFSA' },
    rrsp: { bg: 'linear-gradient(135deg, oklch(52% 0.17 198), oklch(44% 0.18 185))', label: 'RRSP' },
    fhsa: { bg: 'linear-gradient(135deg, oklch(54% 0.17 158), oklch(46% 0.18 148))', label: 'FHSA' },
  };
  const pal = PALETTE[account.id] ?? {
    bg: 'linear-gradient(135deg, oklch(48% 0.12 260), oklch(40% 0.10 260))',
    label: account.name.slice(0, 4).toUpperCase(),
  };

  const hasMV   = effectiveMV > 0;
  const gain    = hasMV ? effectiveMV - netDepositsEffective : null;
  const gainPct = hasMV && netDepositsEffective > 0 ? ((effectiveMV - netDepositsEffective) / netDepositsEffective) * 100 : null;
  const isUp    = gain != null && gain >= 0;

  const saveND = () => {
    const v = parseFloat(ndDraft.replace(/[^0-9.]/g, ''));
    if (!isNaN(v) && v >= 0) { onUpdateND(v, netDepositsRaw); setEditND(false); }
  };
  const saveMV = () => {
    const v = parseFloat(mvDraft.replace(/[^0-9.]/g, ''));
    if (v > 0) { onUpdateMV(v); setEditMV(false); }
  };

  function getEffectiveShares(h: Holding) {
    const ov = sharesOverrides[h.id];
    return ov ? ov.value + (h.shares - ov.base) : h.shares;
  }

  const saveShares = (h: Holding) => {
    const v = parseFloat(sharesDraft.replace(/[^0-9.]/g, ''));
    if (!isNaN(v) && v >= 0) { onUpdateShares(h.id, v, h.shares); setEditSharesId(null); }
  };

  function searchAddTicker(q: string) {
    setAddTickerQuery(q);
    setAddTickerValue('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setAddTickerResults([]); setAddTickerDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setAddTickerResults(data);
        setAddTickerDropdown(data.length > 0);
      } catch { setAddTickerResults([]); }
    }, 300);
  }

  async function saveAddHolding() {
    const ticker = (addTickerValue || addTickerQuery).trim().toUpperCase();
    const sharesNum = parseFloat(addShares);
    if (!ticker || !sharesNum || sharesNum <= 0) return;
    const holdingId = `${account.id}__${ticker}`;
    const existing = holdings.find(h => h.id === holdingId);
    onUpdateHolding({
      id: holdingId,
      accountId: account.id,
      ticker,
      shares: (existing?.shares ?? 0) + sharesNum,
    });
    setAddingHolding(false);
    setAddTickerQuery('');
    setAddTickerValue('');
    setAddShares('');
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node))
        setAddTickerDropdown(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="glass" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: pal.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 11, fontFamily: 'var(--mono)',
            letterSpacing: '-0.03em', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.15)' }}>
            {pal.label}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{account.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{account.institution}</div>
          </div>
        </div>
        <button onClick={onRemove}
          style={{ display: 'flex', padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)' }}>
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Holdings list */}
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Holdings</div>
        {holdings.length === 0 && !addingHolding && (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 6 }}>No holdings recorded yet.</div>
        )}
        {holdings.map(h => {
          const effShares  = getEffectiveShares(h);
          const price      = prices[h.ticker];
          const holdingVal = price != null ? effShares * price : null;
          const hasOv      = !!sharesOverrides[h.id];
          const isEditing  = editSharesId === h.id;
          const isUSD      = usdConverted.includes(h.ticker);
          return (
            <div key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12 }}>{h.ticker}</span>
                  {isUSD && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                      color: 'oklch(52% 0.14 270)', background: 'oklch(52% 0.14 270 / 12%)',
                      border: '1px solid oklch(52% 0.14 270 / 30%)', borderRadius: 3, padding: '1px 4px' }}>
                      USD→CAD
                    </span>
                  )}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
                      <input className="input" value={sharesDraft} onChange={e => setSharesDraft(e.target.value)}
                        autoFocus style={{ width: 80, fontSize: 12 }}
                        onKeyDown={e => e.key === 'Enter' && saveShares(h)} />
                      <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => saveShares(h)}>Save</button>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditSharesId(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        {effShares % 1 === 0 ? effShares.toFixed(0) : effShares.toFixed(4)} sh
                      </span>
                      <button onClick={() => { setEditSharesId(h.id); setSharesDraft(String(effShares)); }}
                        style={{ fontSize: 10, color: 'var(--ink-mute)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline dotted' }}>
                        Edit
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {holdingVal != null && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500 }}>{fmtCAD(holdingVal)}</span>
                  )}
                  {price != null && (
                    <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>@ {fmtCAD(price)}</span>
                  )}
                  <button onClick={() => onRemoveHolding(h.id)}
                    style={{ padding: 2, borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)' }}>
                    <Icon name="x" size={10} />
                  </button>
                </div>
              </div>
              {hasOv && !isEditing && (
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <Icon name="sparkle" size={9} />
                  Manual · txs suggest {h.shares % 1 === 0 ? h.shares.toFixed(0) : h.shares.toFixed(4)} sh
                  <button onClick={() => onResetShares(h.id)}
                    style={{ fontSize: 9, color: 'var(--accent-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Reset
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add holding inline form */}
        {addingHolding ? (
          <div ref={addDropdownRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
            <div style={{ position: 'relative' }}>
              <input className="input" placeholder="Search ticker…" value={addTickerQuery}
                onChange={e => searchAddTicker(e.target.value)}
                style={{ width: '100%', fontSize: 12 }} autoFocus />
              {addTickerDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--popover-solid-bg, var(--bg))', border: '1px solid var(--line-strong)',
                  borderRadius: 8, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.30)', overflow: 'hidden' }}>
                  {addTickerResults.map(r => (
                    <button key={r.ticker}
                      onClick={() => { setAddTickerValue(r.ticker); setAddTickerQuery(`${r.ticker} — ${r.name}`); setAddTickerDropdown(false); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--ink)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, var(--accent), transparent 90%)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, marginRight: 6, color: 'var(--ink)' }}>{r.ticker}</span>
                      <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input className="input" type="number" placeholder="Shares" value={addShares}
              onChange={e => setAddShares(e.target.value)} style={{ fontSize: 12 }}
              onKeyDown={e => e.key === 'Enter' && saveAddHolding()} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={saveAddHolding}>Add</button>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setAddingHolding(false); setAddTickerQuery(''); setAddShares(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 8 }} onClick={() => setAddingHolding(true)}>
            <Icon name="plus" size={11} />Add holding
          </button>
        )}
      </div>

      {/* Net deposits */}
      <div style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Net Deposits</div>
        {editND ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Set current net deposits</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="input" value={ndDraft} onChange={e => setNDDraft(e.target.value)}
                placeholder="e.g. 12500.00" autoFocus style={{ flex: 1, fontSize: 13 }}
                onKeyDown={e => e.key === 'Enter' && saveND()}
                onBlur={saveND} />
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveND}>Save</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditND(false)}>✕</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.025em', fontFamily: 'var(--mono)' }}>
                {netDepositsEffective > 0 ? fmtCAD(netDepositsEffective) : <span style={{ color: 'var(--ink-mute)' }}>—</span>}
              </span>
              <button onClick={() => { setNDDraft(String(Math.round(netDepositsEffective))); setEditND(true); }}
                style={{ fontSize: 11, color: 'var(--ink-mute)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline dotted' }}>
                Edit
              </button>
            </div>
            {hasNdOverride && (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 3, display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Icon name="sparkle" size={10} />
                Manual · txs suggest {fmtCAD(netDepositsRaw)}
                <button onClick={onResetND}
                  style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Reset
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Market value */}
      <div style={{ paddingTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Market Value</div>
        {editMV ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Override market value</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="input" value={mvDraft} onChange={e => setMVDraft(e.target.value)}
                placeholder="e.g. 1420.50" autoFocus style={{ flex: 1, fontSize: 13 }}
                onKeyDown={e => e.key === 'Enter' && saveMV()} />
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveMV}>Save</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditMV(false)}>✕</button>
            </div>
          </div>
        ) : (
          <>
            {hasMV ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', fontFamily: 'var(--mono)' }}>
                  {fmtCAD(effectiveMV)}
                </span>
                {gain != null && (
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)',
                    color: isUp ? 'oklch(48% 0.17 160)' : 'var(--danger)' }}>
                    {isUp ? '+' : ''}{fmtCAD(gain)}
                    {gainPct != null && <span style={{ fontWeight: 400, opacity: 0.75 }}> ({gainPct.toFixed(1)}%)</span>}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 4 }}>
                {holdings.length > 0 ? 'Waiting for prices…' : '—'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => { setMVDraft(String(Math.round(effectiveMV || 0))); setEditMV(true); }}
                style={{ fontSize: 11, padding: '3px 8px' }}>
                <Icon name="edit" size={10} />Edit market value
              </button>
              {hasMVOverride && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>·</span>
                  <button onClick={onResetMV}
                    style={{ fontSize: 11, color: 'var(--accent-ink)', background: 'none',
                      border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Reset to computed
                  </button>
                </>
              )}
            </div>
            {hasMVOverride && (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4, display: 'flex', gap: 5, alignItems: 'center' }}>
                <Icon name="sparkle" size={10} />
                Manual · computed {fmtCAD(computedMVVal)}
              </div>
            )}
            {usdConverted.length > 0 && usdcadRate != null && (
              <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4 }}>
                USD holdings converted at {usdcadRate.toFixed(4)} CAD/USD
              </div>
            )}
          </>
        )}
      </div>

      {/* Contribution room */}
      {!!account.roomLeft && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)',
          fontSize: 11, color: 'var(--ink-mute)' }}>
          Contribution room:{' '}
          <span style={{ color: 'var(--ink-soft)', fontFamily: 'var(--mono)' }}>
            {fmtCAD(account.roomLeft)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Investments page ──────────────────────────────────────────
export function InvestmentsPage() {
  const txs = useQuery(() => db.transactions.toArray(), []) ?? [];

  const [accounts,        setAccountsRaw]       = useState<InvestmentAccount[]>(SI_ACCOUNTS_DEFAULT);
  const [ndOverrides,     setNdOverridesRaw]     = useState<Record<string, { value: number; base: number }>>({});
  const [mvOverrides,     setMVOverridesRaw]     = useState<Record<string, { value: number; base: number }>>({});
  const [sharesOverrides, setSharesOverridesRaw] = useState<Record<string, { value: number; base: number }>>({});
  const [settingsLoaded,  setSettingsLoaded]     = useState(false);

  const holdingsData = useQuery(() => db.holdings.toArray(), []) ?? [];

  const [prices,        setPrices]        = useState<Record<string, number | null>>({});
  const [usdcadRate,    setUsdcadRate]    = useState<number | null>(null);
  const [usdConverted,  setUsdConverted]  = useState<string[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);

  function applyPriceResponse(data: { prices?: Record<string, number | null>; usdcad?: number | null; converted?: string[] }) {
    setPrices(data.prices ?? {});
    setUsdcadRate(data.usdcad ?? null);
    setUsdConverted(data.converted ?? []);
  }

  const tickerKey = holdingsData.map(h => h.ticker).sort().join(',');
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

  useEffect(() => {
    Promise.all([
      db.settings.get('si_accounts'),
      db.settings.get('si_nd_overrides'),
      db.settings.get('si_mv_overrides'),
      db.settings.get('si_shares_overrides'),
    ]).then(([a, ndo, mvo, sho]) => {
      if (a)   setAccountsRaw(a.value as InvestmentAccount[]);
      if (ndo) setNdOverridesRaw(ndo.value as Record<string, { value: number; base: number }>);
      if (mvo) setMVOverridesRaw(mvo.value as Record<string, { value: number; base: number }>);
      if (sho) setSharesOverridesRaw(sho.value as Record<string, { value: number; base: number }>);
      setSettingsLoaded(true);
    });
  }, []);

  function setAccounts(next: InvestmentAccount[]) {
    setAccountsRaw(next);
    db.settings.put({ key: 'si_accounts', value: next });
  }

  const investTxsAll = useMemo(() =>
    txs.filter(t => t.type === 'investment' && !t.hidden)
       .sort((a, b) => b.date.localeCompare(a.date)),
  [txs]);

  const getNetDepositsRaw = (id: string) =>
    investTxsAll.filter(t => t.investmentAccount === id).reduce((s, t) => s + t.amount, 0);

  const getEffectiveNetDeposits = (id: string) => {
    const raw = getNetDepositsRaw(id);
    const ov = ndOverrides[id];
    return ov ? ov.value + (raw - ov.base) : raw;
  };

  function setNdOverride(id: string, value: number, base: number) {
    const next = { ...ndOverrides, [id]: { value, base } };
    setNdOverridesRaw(next);
    db.settings.put({ key: 'si_nd_overrides', value: next });
  }

  function resetNdOverride(id: string) {
    const next = { ...ndOverrides };
    delete next[id];
    setNdOverridesRaw(next);
    db.settings.put({ key: 'si_nd_overrides', value: next });
  }

  const totalNetDeposits = useMemo(() =>
    accounts.reduce((s, a) => s + getEffectiveNetDeposits(a.id), 0),
  [accounts, investTxsAll, ndOverrides]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalMarketValue = useMemo(() =>
    accounts.reduce((s, a) => s + getEffectiveMV(a.id), 0),
  [accounts, holdingsData, prices, mvOverrides, sharesOverrides]); // eslint-disable-line react-hooks/exhaustive-deps

  function setSharesOverride(holdingId: string, value: number, base: number) {
    const next = { ...sharesOverrides, [holdingId]: { value, base } };
    setSharesOverridesRaw(next);
    db.settings.put({ key: 'si_shares_overrides', value: next });
  }
  function resetSharesOverride(holdingId: string) {
    const next = { ...sharesOverrides };
    delete next[holdingId];
    setSharesOverridesRaw(next);
    db.settings.put({ key: 'si_shares_overrides', value: next });
  }
  function getEffectiveShares(holdingId: string, rawShares: number) {
    const ov = sharesOverrides[holdingId];
    return ov ? ov.value + (rawShares - ov.base) : rawShares;
  }

  function computedMV(accountId: string): number {
    return holdingsData
      .filter(h => h.accountId === accountId)
      .reduce((s, h) => s + getEffectiveShares(h.id, h.shares) * (prices[h.ticker] ?? 0), 0);
  }

  function setMVOverride(accountId: string, value: number) {
    const base = computedMV(accountId);
    const next = { ...mvOverrides, [accountId]: { value, base } };
    setMVOverridesRaw(next);
    db.settings.put({ key: 'si_mv_overrides', value: next });
  }
  function resetMVOverride(accountId: string) {
    const next = { ...mvOverrides };
    delete next[accountId];
    setMVOverridesRaw(next);
    db.settings.put({ key: 'si_mv_overrides', value: next });
  }
  function getEffectiveMV(accountId: string): number {
    const computed = computedMV(accountId);
    const ov = mvOverrides[accountId];
    return ov ? ov.value + (computed - ov.base) : computed;
  }

  const removeAccount = (id: string) =>
    setAccounts(accounts.filter(a => a.id !== id));

  const [showAddAccount,        setShowAddAccount]        = useState(false);
  const [newAccountName,        setNewAccountName]        = useState('');
  const [newAccountInstitution, setNewAccountInstitution] = useState('');
  const [editDialogTx,          setEditDialogTx]          = useState<Transaction | null>(null);

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    setAccounts([...accounts, {
      id: 'acct-' + Date.now(),
      name: newAccountName.trim().toUpperCase(),
      institution: newAccountInstitution.trim(),
    }]);
    setNewAccountName('');
    setNewAccountInstitution('');
    setShowAddAccount(false);
  };

  if (!settingsLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-mute)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040 }}>

      {/* ── Page header ──────────────────────────────────────── */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Wealth</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Investments</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 560 }}>
              Track your investment accounts, holdings, and portfolio performance.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 4 }}>
            {holdingsData.length > 0 && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={refreshPrices} disabled={pricesLoading}>
                <Icon name={pricesLoading ? 'sparkle' : 'refresh'} size={12} />
                {pricesLoading ? 'Refreshing…' : 'Refresh prices'}
              </button>
            )}
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowAddAccount(true)}>
              <Icon name="plus" size={12} />Add account
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary stats ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Total net deposits</div>
          <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', fontFamily: 'var(--mono)' }}>
            {fmtCAD(totalNetDeposits)}
          </div>
        </div>
        {totalMarketValue > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Total market value</div>
            <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', fontFamily: 'var(--mono)',
              color: totalMarketValue >= totalNetDeposits ? 'oklch(48% 0.17 160)' : 'var(--danger)' }}>
              {fmtCAD(totalMarketValue)}
            </div>
            {usdcadRate != null && usdConverted.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>
                USD→CAD @ {usdcadRate.toFixed(4)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Account cards ──────────────────────────────────────── */}
      {accounts.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 12,
          maxWidth: (accounts.length + (showAddAccount ? 1 : 0)) <= 1 ? 560 : '100%',
          margin: (accounts.length + (showAddAccount ? 1 : 0)) <= 1 ? '0 auto' : undefined,
          width: '100%',
        }}>
          {accounts.map(a => (
            <InvestAccountCard
              key={a.id}
              account={a}
              holdings={holdingsData.filter(h => h.accountId === a.id)}
              prices={prices}
              usdConverted={usdConverted}
              usdcadRate={usdcadRate}
              effectiveMV={getEffectiveMV(a.id)}
              computedMVVal={computedMV(a.id)}
              netDepositsEffective={getEffectiveNetDeposits(a.id)}
              netDepositsRaw={getNetDepositsRaw(a.id)}
              hasNdOverride={!!ndOverrides[a.id]}
              hasMVOverride={!!mvOverrides[a.id]}
              sharesOverrides={sharesOverrides}
              onUpdateND={(val, base) => setNdOverride(a.id, val, base)}
              onResetND={() => resetNdOverride(a.id)}
              onUpdateMV={val => setMVOverride(a.id, val)}
              onResetMV={() => resetMVOverride(a.id)}
              onUpdateHolding={h => db.holdings.put(h)}
              onRemoveHolding={id => db.holdings.delete(id)}
              onUpdateShares={(hid, val, base) => setSharesOverride(hid, val, base)}
              onResetShares={hid => resetSharesOverride(hid)}
              onRemove={() => removeAccount(a.id)} />
          ))}
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
      ) : (
        <div className="glass" style={{ padding: 28 }}>
          {showAddAccount ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--ink-mute)' }}>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                No investment accounts. Add your TFSA, RRSP, or any other account.
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddAccount(true)}>
                <Icon name="plus" size={12} />Add account
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Investment history table ──────────────────────────── */}
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
                <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-mute)', fontSize: 13 }}>
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
