import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import type { Transaction } from '../types';
import { applyEvenSplit, applyCustomSplit, clearSplit } from '../lib/split';
import { fmtCAD } from '../lib/money';

interface Props {
  tx: Transaction;
  onClose: () => void;
}

type Mode = 'even' | 'custom';

export function SplitDialog({ tx, onClose }: Props) {
  const original = tx.split?.originalAmount ?? tx.amount;
  const [mode, setMode] = useState<Mode>(tx.split?.perPerson && tx.split.perPerson.some(p => p.amount !== tx.split!.myShare) ? 'custom' : 'even');
  const [people, setPeople] = useState<number>(tx.split?.people ?? 2);
  const [otherNames, setOtherNames] = useState<string[]>(() => {
    const existing = tx.split?.perPerson?.map((p) => p.name) ?? [];
    const count = Math.max((tx.split?.people ?? 2) - 1, 1);
    const filled = [...existing];
    while (filled.length < count) filled.push('');
    return filled;
  });
  const [custom, setCustom] = useState(() => {
    const existing = tx.split?.perPerson ?? [];
    return {
      my: tx.split?.myShare ?? Math.round(original / 2 * 100) / 100,
      others: existing.length ? existing.map((p) => ({ name: p.name, amount: p.amount })) : [{ name: '', amount: Math.round(original / 2 * 100) / 100 }],
    };
  });
  const contacts = useQuery(() => db.contacts.toArray(), []) ?? [];
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateOtherName(idx: number, value: string) {
    setOtherNames((prev) => prev.map((n, i) => (i === idx ? value : n)));
  }

  function setPeopleCount(n: number) {
    setPeople(n);
    setOtherNames((prev) => {
      const needed = Math.max(n - 1, 0);
      const out = [...prev];
      while (out.length < needed) out.push('');
      return out.slice(0, needed);
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const names = mode === 'even'
        ? otherNames.slice(0, people - 1)
        : custom.others.map(p => p.name);
      if (mode === 'even') {
        await applyEvenSplit(tx.id, { totalPeople: people, otherPeople: names });
      } else {
        await applyCustomSplit(tx.id, { myAmount: custom.my, others: custom.others });
      }
      // Auto-create contacts for any new names
      const existingNames = new Set(contacts.map(c => c.name.toLowerCase()));
      for (const name of names) {
        const trimmed = name.trim();
        if (trimmed && !existingNames.has(trimmed.toLowerCase())) {
          await db.contacts.add({ id: nanoid(), name: trimmed, createdAt: Date.now() });
          existingNames.add(trimmed.toLowerCase());
        }
      }
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    await clearSplit(tx.id);
    setBusy(false);
    onClose();
  }

  const myShareEven = people >= 2 ? Math.round((original / people) * 100) / 100 : original;
  const customTotal = custom.my + custom.others.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="text-lg font-semibold">Split transaction</div>
          <div className="text-sm text-slate-600">{tx.merchantRaw} · {fmtCAD(original)} on {tx.date}</div>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setMode('even')}
            className={`px-3 py-1.5 rounded border ${mode === 'even' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300'}`}
          >
            Even split
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 rounded border ${mode === 'custom' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300'}`}
          >
            Custom amounts
          </button>
        </div>

        {mode === 'even' ? (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-slate-600">Total people (including you)</span>
              <input
                type="number"
                min={2}
                max={20}
                value={people}
                onChange={(e) => setPeopleCount(Math.max(2, parseInt(e.target.value || '2', 10)))}
                className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <div>
              <div className="text-sm text-slate-600 mb-1">Other people (names)</div>
              <datalist id="split-contacts">
                {contacts.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
              <div className="space-y-1">
                {otherNames.slice(0, people - 1).map((name, i) => (
                  <input
                    key={i}
                    list="split-contacts"
                    value={name}
                    onChange={(e) => updateOtherName(i, e.target.value)}
                    placeholder={`Person ${i + 1} name`}
                    className="block w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                ))}
              </div>
            </div>
            <div className="rounded bg-slate-50 px-3 py-2 text-sm">
              Your share: <span className="font-medium tabular-nums">{fmtCAD(myShareEven)}</span>
              <span className="text-slate-500"> · each other person owes {fmtCAD(myShareEven)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-28 text-slate-600">Your share</span>
              <input
                type="number"
                step="0.01"
                value={custom.my}
                onChange={(e) => setCustom({ ...custom, my: parseFloat(e.target.value || '0') })}
                className="w-28 rounded border border-slate-300 px-2 py-1 tabular-nums"
              />
            </div>
            {custom.others.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <input
                  list="split-contacts"
                  value={p.name}
                  onChange={(e) => {
                    const others = [...custom.others];
                    others[i] = { ...others[i], name: e.target.value };
                    setCustom({ ...custom, others });
                  }}
                  placeholder={`Person ${i + 1}`}
                  className="w-28 rounded border border-slate-300 px-2 py-1"
                />
                <input
                  type="number"
                  step="0.01"
                  value={p.amount}
                  onChange={(e) => {
                    const others = [...custom.others];
                    others[i] = { ...others[i], amount: parseFloat(e.target.value || '0') };
                    setCustom({ ...custom, others });
                  }}
                  className="w-28 rounded border border-slate-300 px-2 py-1 tabular-nums"
                />
                <button
                  onClick={() => setCustom({ ...custom, others: custom.others.filter((_, j) => j !== i) })}
                  className="text-slate-400 hover:text-rose-600 text-sm"
                >
                  remove
                </button>
              </div>
            ))}
            <button
              onClick={() => setCustom({ ...custom, others: [...custom.others, { name: '', amount: 0 }] })}
              className="text-sm text-sky-600 hover:text-sky-800"
            >
              + add person
            </button>
            <div className={`text-xs tabular-nums ${Math.abs(customTotal - original) < 0.02 ? 'text-emerald-700' : 'text-rose-600'}`}>
              Total: {fmtCAD(customTotal)} / {fmtCAD(original)}
            </div>
          </div>
        )}

        {err && <div className="text-sm text-rose-600">{err}</div>}

        <div className="flex justify-between pt-2">
          <button
            onClick={remove}
            disabled={!tx.split}
            className="px-3 py-1.5 text-sm text-rose-600 hover:text-rose-800 disabled:text-slate-300"
          >
            Remove split
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300">Cancel</button>
            <button
              onClick={save}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Save split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
