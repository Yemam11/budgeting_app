import { useState } from 'react';
import { DropZone } from '../components/DropZone';
import { buildPreview, commitImport, type ImportPreview } from '../lib/import';
import { fmtCAD } from '../lib/money';

export function ImportPage() {
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<string[]>([]);

  async function onFiles(files: File[]) {
    setBusy(true);
    setErrors([]);
    const out: ImportPreview[] = [];
    const errs: string[] = [];
    for (const f of files) {
      try {
        const p = await buildPreview(f);
        out.push(p);
      } catch (e) {
        errs.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setPreviews((prev) => [...prev, ...out]);
    setErrors(errs);
    setBusy(false);
  }

  async function confirm(p: ImportPreview) {
    setBusy(true);
    await commitImport(p);
    setCommitted((prev) => [...prev, p.filename]);
    setPreviews((prev) => prev.filter((x) => x !== p));
    setBusy(false);
  }

  function dismiss(p: ImportPreview) {
    setPreviews((prev) => prev.filter((x) => x !== p));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Import</h1>
        <p className="text-sm text-slate-600">Drop exported statements from Amex, BMO, or Scotia. Duplicates are auto-detected.</p>
      </div>

      <DropZone onFiles={onFiles} />

      {busy && <div className="text-sm text-slate-500">Parsing…</div>}

      {errors.length > 0 && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          <div className="font-medium mb-1">Errors</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {committed.length > 0 && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          Imported: {committed.join(', ')}
        </div>
      )}

      {previews.map((p, i) => (
        <div key={i} className="rounded border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium">{p.filename}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">{p.parseResult.bank}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => dismiss(p)}
                className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => confirm(p)}
                disabled={p.newCount === 0 || busy}
                className="px-3 py-1.5 text-sm rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Import {p.newCount}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="New" value={String(p.newCount)} />
            <Stat label="Duplicates" value={String(p.duplicates)} />
            <Stat label="Warnings" value={String(p.warnings.length)} />
          </div>

          {p.warnings.length > 0 && (
            <details className="text-xs text-amber-700">
              <summary className="cursor-pointer">Warnings ({p.warnings.length})</summary>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {p.warnings.slice(0, 50).map((w, j) => <li key={j}>{w}</li>)}
              </ul>
            </details>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Merchant</th>
                  <th className="py-1 pr-2">Type</th>
                  <th className="py-1 pr-2 text-right">Amount</th>
                  <th className="py-1 pr-2">Proposed category</th>
                  <th className="py-1 pr-2">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {p.candidates.slice(0, 25).map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2 text-slate-600">{t.date}</td>
                    <td className="py-1 pr-2">{t.merchantRaw}</td>
                    <td className="py-1 pr-2 text-xs uppercase text-slate-500">{t.type}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{fmtCAD(t.amount)}</td>
                    <td className="py-1 pr-2">{t.categoryId ?? <span className="text-slate-400">—</span>}</td>
                    <td className="py-1 pr-2 text-xs text-slate-500">{Math.round(t.categoryConfidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.candidates.length > 25 && (
              <div className="text-xs text-slate-500 mt-1">…and {p.candidates.length - 25} more</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-medium tabular-nums">{value}</div>
    </div>
  );
}
