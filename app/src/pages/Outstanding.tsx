import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import { Icon } from '../components/Primitives';
import {
  confirmSettlement, manuallySettle, settleMultiple, daysBetween,
} from '../lib/outstanding';
import { clearSplit } from '../lib/split';
import type { OutstandingEntry, Transaction } from '../types';

const MATCH_TOLERANCE = 2.00;
const MATCH_WINDOW_DAYS = 45;

export function OutstandingPage() {
  const entries = useQuery(() => db.outstanding.toArray(), []) ?? [];
  const txs = useQuery(() => db.transactions.toArray(), []) ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const txMap = useMemo(() => new Map(txs.map(t => [t.id, t])), [txs]);
  const outstanding = entries.filter(e => e.status !== 'settled');
  const settled = entries.filter(e => e.status === 'settled');

  const byPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of outstanding) m.set(e.personName, (m.get(e.personName) ?? 0) + e.amount);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [outstanding]);

  const totalOutstanding = outstanding.reduce((s, e) => s + e.amount, 0);

  // Compute repayment matches for each outstanding entry
  const matchData = useMemo(() => {
    const inflows = txs.filter(t =>
      (t.type === 'income' || (t.type === 'spend' && t.amount < 0)) && !t.hidden
    );

    const byPersonEntries = new Map<string, OutstandingEntry[]>();
    for (const e of outstanding) {
      const arr = byPersonEntries.get(e.personName) ?? [];
      arr.push(e);
      byPersonEntries.set(e.personName, arr);
    }

    const usedTxIds = new Set(
      outstanding.filter(e => e.settledByTransactionId).map(e => e.settledByTransactionId!)
    );

    const directMatches = new Map<string, { tx: Transaction; daysAfter: number }[]>();
    const splitMatches = new Map<string, { tx: Transaction; coverEntries: OutstandingEntry[] }[]>();

    for (const entry of outstanding) {
      const srcTx = txMap.get(entry.transactionId);
      if (!srcTx) { directMatches.set(entry.id, []); continue; }

      const directs: { tx: Transaction; daysAfter: number }[] = [];
      for (const tx of inflows) {
        if (usedTxIds.has(tx.id)) continue;
        const inflowAmt = Math.abs(tx.amount);
        const delta = daysBetween(srcTx.date, tx.date);
        if (delta < 0 || delta > MATCH_WINDOW_DAYS) continue;
        if (Math.abs(inflowAmt - entry.amount) <= MATCH_TOLERANCE) {
          directs.push({ tx, daysAfter: delta });
        }
      }
      directMatches.set(entry.id, directs.sort((a, b) => a.daysAfter - b.daysAfter));

      const personEntries = byPersonEntries.get(entry.personName) ?? [];
      if (personEntries.length > 1) {
        const totalOwed = personEntries.reduce((s, e) => s + e.amount, 0);
        const splits: { tx: Transaction; coverEntries: OutstandingEntry[] }[] = [];
        for (const tx of inflows) {
          if (usedTxIds.has(tx.id)) continue;
          const inflowAmt = Math.abs(tx.amount);
          const delta = daysBetween(srcTx.date, tx.date);
          if (delta < 0 || delta > MATCH_WINDOW_DAYS) continue;
          if (Math.abs(inflowAmt - totalOwed) <= MATCH_TOLERANCE) {
            splits.push({ tx, coverEntries: personEntries });
          }
        }
        splitMatches.set(entry.id, splits);
      }
    }

    return { directMatches, splitMatches };
  }, [outstanding, txs, txMap]);

  const totalMatchCount = outstanding.filter(e =>
    (matchData.directMatches.get(e.id)?.length ?? 0) > 0 ||
    (matchData.splitMatches.get(e.id)?.length ?? 0) > 0
  ).length;

  function dKey(entryId: string, txId: string) { return `${entryId}:${txId}`; }
  function dismiss(entryId: string, txId: string) {
    setDismissed(prev => new Set([...prev, dKey(entryId, txId)]));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Splits</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Owed to you</div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4, maxWidth: 640 }}>
          Created automatically from split transactions. Click any row to see the origin and possible repayments.
        </div>
      </div>

      {/* Summary card */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: byPerson.length > 0 ? 16 : 0 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Total outstanding</div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {fmtCAD(totalOutstanding)}
            </div>
          </div>
          {byPerson.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              across {byPerson.length} {byPerson.length === 1 ? 'person' : 'people'} · {outstanding.length} {outstanding.length === 1 ? 'transaction' : 'transactions'}
            </div>
          )}
        </div>

        {byPerson.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(byPerson.length, 4)}, 1fr)`, gap: 10 }}>
            {byPerson.map(([name, amt]) => (
              <div key={name} style={{ padding: 14, borderRadius: 12, background: 'color-mix(in oklab, white 60%, transparent)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: `oklch(70% 0.08 ${(name.charCodeAt(0) * 7) % 360})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 12, fontWeight: 500, flexShrink: 0,
                  }}>
                    {name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                      {outstanding.filter(e => e.personName === name).length} open
                    </div>
                  </div>
                  <div className="mono" style={{ fontWeight: 500, fontSize: 13 }}>{fmtCAD(amt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {byPerson.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Nothing outstanding right now.</div>
        )}
      </div>

      {/* Match notice */}
      {totalMatchCount > 0 && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'color-mix(in oklab, oklch(95% 0.08 75), white 40%)', border: '1px solid oklch(80% 0.12 75 / 0.5)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={14} />
          <span>
            {totalMatchCount} {totalMatchCount === 1 ? 'amount has' : 'amounts have'} a possible repayment —
            click a row to review.
          </span>
        </div>
      )}

      {/* Outstanding table */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', fontWeight: 500, fontSize: 13 }}>
          Outstanding ({outstanding.length})
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Person</th>
              <th>Originated from</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map(e => {
              const isExpanded = expandedId === e.id;
              const src = txMap.get(e.transactionId);
              const directs = (matchData.directMatches.get(e.id) ?? []).filter(m => !dismissed.has(dKey(e.id, m.tx.id)));
              const splits = (matchData.splitMatches.get(e.id) ?? []).filter(m => !dismissed.has(dKey(e.id, m.tx.id)));
              const hasMatches = directs.length > 0 || splits.length > 0;

              return (
                <Fragment key={e.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    style={{ cursor: 'pointer', background: isExpanded ? 'color-mix(in oklab, var(--accent-soft), white 40%)' : undefined }}
                  >
                    <td style={{ fontWeight: 500 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {e.personName}
                        {hasMatches && (
                          <span
                            style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(62% 0.16 75)', flexShrink: 0, boxShadow: '0 0 0 3px oklch(62% 0.16 75 / 0.2)' }}
                            title="Possible repayment detected"
                          />
                        )}
                      </span>
                    </td>
                    <td>{src?.merchantRaw ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{src?.date ?? '—'}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCAD(e.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ color: 'var(--ink-mute)', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'flex' }}>
                          <Icon name="chevron_down" size={13} />
                        </span>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
                          onClick={async evt => {
                            evt.stopPropagation();
                            if (window.confirm(`Remove the owed entry for ${e.personName} (${fmtCAD(e.amount)})?`)) {
                              await db.outstanding.delete(e.id);
                              const remaining = await db.outstanding.where('transactionId').equals(e.transactionId).toArray();
                              if (!remaining.some(r => r.status !== 'settled')) {
                                await clearSplit(e.transactionId);
                              }
                            }
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={evt => { evt.stopPropagation(); manuallySettle(e.id); }}
                        >
                          Mark paid
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, background: 'color-mix(in oklab, var(--accent-soft), white 55%)', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                          {/* Origin transaction */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                              Origin transaction
                            </div>
                            {src ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'white', borderRadius: 8, border: '1px solid var(--line)' }}>
                                <span style={{ color: 'var(--ink-mute)', display: 'flex' }}><Icon name="arrow_down_right" size={14} /></span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 500, fontSize: 13 }}>{src.merchantRaw}</div>
                                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{src.date}</div>
                                </div>
                                <div className="mono" style={{ fontWeight: 500, fontSize: 13 }}>{fmtCAD(Math.abs(src.amount))}</div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Original transaction not found.</div>
                            )}
                          </div>

                          {/* Repayment suggestions */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                              Possible repayments
                            </div>

                            {directs.length === 0 && splits.length === 0 ? (
                              <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '10px 0' }}>
                                No matching income transactions found within {MATCH_WINDOW_DAYS} days. Use "Mark paid" to settle manually.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {directs.map(m => {
                                  const diff = Math.abs(Math.abs(m.tx.amount) - e.amount);
                                  const label = diff < 0.01 ? 'Exact match' : `Δ${fmtCAD(diff)}`;
                                  return (
                                    <div
                                      key={m.tx.id}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'color-mix(in oklab, oklch(95% 0.06 75), white 40%)', borderRadius: 8, border: '1px solid oklch(80% 0.1 75 / 0.4)' }}
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.tx.merchantRaw}</div>
                                        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                                          {m.tx.date} · {m.daysAfter} day{m.daysAfter === 1 ? '' : 's'} after ·{' '}
                                          <span className="mono">{fmtCAD(Math.abs(m.tx.amount))}</span> · {label}
                                        </div>
                                      </div>
                                      <button
                                        className="btn btn-ghost"
                                        style={{ fontSize: 11, flexShrink: 0 }}
                                        onClick={() => dismiss(e.id, m.tx.id)}
                                      >
                                        <Icon name="x" size={11} />Not a match
                                      </button>
                                      <button
                                        className="btn btn-primary"
                                        style={{ fontSize: 11, flexShrink: 0 }}
                                        onClick={() => { confirmSettlement(e.id, m.tx.id); setExpandedId(null); }}
                                      >
                                        <Icon name="check" size={11} />Confirm settled
                                      </button>
                                    </div>
                                  );
                                })}

                                {splits.map(m => (
                                  <div
                                    key={`split-${m.tx.id}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'color-mix(in oklab, oklch(95% 0.05 260), white 50%)', borderRadius: 8, border: '1px solid oklch(75% 0.08 260 / 0.4)' }}
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.tx.merchantRaw}</div>
                                      <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                                        {m.tx.date} · <span className="mono">{fmtCAD(Math.abs(m.tx.amount))}</span> covers all {m.coverEntries.length} amounts owed by {e.personName} ({fmtCAD(m.coverEntries.reduce((s, ce) => s + ce.amount, 0))})
                                      </div>
                                    </div>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ fontSize: 11, flexShrink: 0 }}
                                      onClick={() => dismiss(e.id, m.tx.id)}
                                    >
                                      <Icon name="x" size={11} />Not a match
                                    </button>
                                    <button
                                      className="btn btn-primary"
                                      style={{ fontSize: 11, flexShrink: 0 }}
                                      onClick={() => { settleMultiple(m.coverEntries.map(ce => ce.id), m.tx.id); setExpandedId(null); }}
                                    >
                                      <Icon name="check" size={11} />Settle all {m.coverEntries.length} from {e.personName}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {outstanding.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-mute)', padding: '28px 0', fontSize: 13 }}>
                  No outstanding amounts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Settled (collapsible) */}
      {settled.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-mute)', padding: '4px 0' }}>
            Settled ({settled.length})
          </summary>
          <div className="glass" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
            <table className="data">
              <tbody>
                {settled.map(e => {
                  const src = txMap.get(e.transactionId);
                  const settledBy = e.settledByTransactionId ? txMap.get(e.settledByTransactionId) : undefined;
                  return (
                    <tr key={e.id} style={{ opacity: 0.6 }}>
                      <td style={{ fontWeight: 500 }}>{e.personName}</td>
                      <td>{src?.merchantRaw ?? '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtCAD(e.amount)}</td>
                      <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                        {settledBy ? `via ${settledBy.merchantRaw}` : 'manually'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                          onClick={() => db.outstanding.delete(e.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
