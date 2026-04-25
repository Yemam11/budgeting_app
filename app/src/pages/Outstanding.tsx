import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import {
  findMatchProposals, confirmSettlement, dismissProposal, manuallySettle,
  type MatchProposal,
} from '../lib/outstanding';

export function OutstandingPage() {
  const entries = useLiveQuery(() => db.outstanding.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [proposals, setProposals] = useState<MatchProposal[]>([]);

  useEffect(() => {
    findMatchProposals().then(setProposals);
  }, [entries, txs]);

  const txMap = useMemo(() => new Map(txs.map((t) => [t.id, t])), [txs]);

  const outstanding = entries.filter((e) => e.status !== 'settled');
  const settled = entries.filter((e) => e.status === 'settled');

  const byPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of outstanding) {
      m.set(e.personName, (m.get(e.personName) ?? 0) + e.amount);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [outstanding]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Owed to me</h1>
        <p className="text-sm text-slate-600">Created automatically from split transactions. E-Transfer inflows matching an open amount are proposed as settlements.</p>
      </div>

      {byPerson.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium mb-2">By person</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {byPerson.map(([name, amt]) => (
              <div key={name} className="rounded bg-slate-50 px-3 py-2 flex justify-between">
                <span className="font-medium">{name}</span>
                <span className="tabular-nums">{fmtCAD(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposals.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 space-y-2">
          <div className="text-sm font-medium text-amber-900">Possible settlements ({proposals.length})</div>
          {proposals.map((p) => {
            const src = txMap.get(p.entry.transactionId);
            return (
              <div key={p.entry.id + p.transaction.id} className="bg-white rounded p-3 flex items-center justify-between">
                <div className="text-sm">
                  <div><span className="font-medium">{p.entry.personName}</span> may have repaid <span className="font-medium tabular-nums">{fmtCAD(p.entry.amount)}</span></div>
                  <div className="text-xs text-slate-500">
                    {src && <>Original: {src.merchantRaw} · {src.date}. </>}
                    Inflow {p.transaction.date} — {p.transaction.merchantRaw} ({p.daysAfter} day{p.daysAfter === 1 ? '' : 's'} later)
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => dismissProposal(p.entry.id)}
                    className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                  >
                    Not a match
                  </button>
                  <button
                    onClick={() => confirmSettlement(p.entry.id, p.transaction.id)}
                    className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Confirm settled
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-sm font-medium">Outstanding ({outstanding.length})</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map((e) => {
              const src = txMap.get(e.transactionId);
              return (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{e.personName}</td>
                  <td className="px-3 py-2">{src?.merchantRaw ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-600 tabular-nums">{src?.date ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtCAD(e.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => manuallySettle(e.id)}
                      className="text-xs text-emerald-700 hover:text-emerald-900"
                    >
                      Mark paid
                    </button>
                  </td>
                </tr>
              );
            })}
            {outstanding.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No outstanding amounts.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {settled.length > 0 && (
        <details className="rounded border border-slate-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm text-slate-600">Settled ({settled.length})</summary>
          <table className="w-full text-sm">
            <tbody>
              {settled.map((e) => {
                const src = txMap.get(e.transactionId);
                return (
                  <tr key={e.id} className="border-t border-slate-100 text-slate-500">
                    <td className="px-3 py-1">{e.personName}</td>
                    <td className="px-3 py-1">{src?.merchantRaw ?? '—'}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmtCAD(e.amount)}</td>
                    <td className="px-3 py-1 text-right">
                      <button onClick={() => db.outstanding.delete(e.id)} className="text-xs text-rose-600 hover:text-rose-800">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
