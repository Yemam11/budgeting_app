import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import { Icon } from '../components/Primitives';
import {
  findMatchProposals, confirmSettlement, dismissProposal, manuallySettle,
  type MatchProposal,
} from '../lib/outstanding';

export function OutstandingPage() {
  const entries = useQuery(() => db.outstanding.toArray(), []) ?? [];
  const txs = useQuery(() => db.transactions.toArray(), []) ?? [];
  const [proposals, setProposals] = useState<MatchProposal[]>([]);

  useEffect(() => {
    findMatchProposals().then(setProposals);
  }, [entries, txs]);

  const txMap = useMemo(() => new Map(txs.map(t => [t.id, t])), [txs]);
  const outstanding = entries.filter(e => e.status !== 'settled');
  const settled = entries.filter(e => e.status === 'settled');

  const byPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of outstanding) m.set(e.personName, (m.get(e.personName) ?? 0) + e.amount);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [outstanding]);

  const totalOutstanding = outstanding.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Splits</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Owed to you</div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4, maxWidth: 640 }}>
          Created automatically from split transactions. E-Transfer inflows matching an open amount are proposed as settlements.
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

      {/* Settlement proposals */}
      {proposals.length > 0 && (
        <div className="glass" style={{ padding: 18, background: 'color-mix(in oklab, oklch(95% 0.05 75), white 50%)', border: '1px solid oklch(80% 0.1 75 / 0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="sparkle" size={14} />
            <div style={{ fontWeight: 500, fontSize: 13 }}>Possible settlements ({proposals.length})</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proposals.map(p => {
              const src = txMap.get(p.entry.transactionId);
              return (
                <div key={p.entry.id + p.transaction.id} style={{ background: 'white', padding: 14, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)' }}>
                  <div>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{p.entry.personName}</span> may have repaid{' '}
                      <span className="mono" style={{ fontWeight: 500 }}>{fmtCAD(p.entry.amount)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                      {src && <>From {src.merchantRaw} · {src.date} · </>}
                      matched inflow {p.transaction.date} — {p.transaction.merchantRaw} ({p.daysAfter} day{p.daysAfter === 1 ? '' : 's'} later)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 16 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => dismissProposal(p.entry.id)}>
                      Not a match
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => confirmSettlement(p.entry.id, p.transaction.id)}>
                      <Icon name="check" size={12} />Confirm settled
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map(e => {
              const src = txMap.get(e.transactionId);
              return (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.personName}</td>
                  <td>{src?.merchantRaw ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{src?.date ?? '—'}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCAD(e.amount)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
                        onClick={async () => {
                          if (window.confirm(`Remove the owed entry for ${e.personName} (${fmtCAD(e.amount)})?`)) {
                            await db.outstanding.delete(e.id);
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => manuallySettle(e.id)}
                      >
                        Mark paid
                      </button>
                    </div>
                  </td>
                </tr>
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
                  return (
                    <tr key={e.id} style={{ opacity: 0.6 }}>
                      <td style={{ fontWeight: 500 }}>{e.personName}</td>
                      <td>{src?.merchantRaw ?? '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtCAD(e.amount)}</td>
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
