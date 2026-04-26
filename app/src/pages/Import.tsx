import { useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { DropZone } from '../components/DropZone';
import { buildPreview, commitImport, type ImportPreview } from '../lib/import';
import { fmtCAD } from '../lib/money';
import { Icon, BankLogo } from '../components/Primitives';

const BANKS = [
  { bank: 'amex', name: 'American Express', hint: 'Export → Activity → .csv' },
  { bank: 'bmo', name: 'BMO', hint: 'Transactions → Download .csv' },
  { bank: 'scotia', name: 'Scotiabank', hint: 'Statements → Export .csv' },
] as const;

export function ImportPage() {
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<string[]>([]);

  const batches = useQuery(
    () => db.importBatches.orderBy('importedAt').reverse().toArray(), []
  ) ?? [];

  async function onFiles(files: File[]) {
    setBusy(true);
    setErrors([]);
    const out: ImportPreview[] = [];
    const errs: string[] = [];
    for (const f of files) {
      try {
        out.push(await buildPreview(f));
      } catch (e) {
        errs.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setPreviews(prev => [...prev, ...out]);
    setErrors(errs);
    setBusy(false);
  }

  async function confirm(p: ImportPreview) {
    setBusy(true);
    await commitImport(p);
    setCommitted(prev => [...prev, p.filename]);
    setPreviews(prev => prev.filter(x => x !== p));
    setBusy(false);
  }

  function dismiss(p: ImportPreview) {
    setPreviews(prev => prev.filter(x => x !== p));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Data</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Import statements</div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4, maxWidth: 580 }}>
          Drop CSV exports from your bank. Everything is parsed, categorized and stored locally — your data never leaves this device.
        </div>
      </div>

      <DropZone onFiles={onFiles} busy={busy} />

      {errors.length > 0 && (
        <div style={{ padding: 14, borderRadius: 12, background: 'oklch(97% 0.02 15)', border: '1px solid oklch(80% 0.08 15)', color: 'var(--danger)' }}>
          <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 13 }}>Parse errors</div>
          <ul style={{ fontSize: 12, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {committed.length > 0 && (
        <div style={{ padding: 12, borderRadius: 12, background: 'color-mix(in oklab, var(--accent-soft), white 40%)', border: '1px solid color-mix(in oklab, var(--accent), transparent 60%)', fontSize: 13, color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={14} />
          Imported: {committed.join(', ')}
        </div>
      )}

      {/* Preview cards */}
      {previews.map((p, i) => (
        <div key={i} className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="file" size={14} />
                <span className="mono">{p.filename}</span>
              </div>
              <div className="eyebrow" style={{ marginTop: 4 }}>{p.parseResult.bank}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => dismiss(p)}>Dismiss</button>
              <button
                className="btn btn-primary"
                onClick={() => confirm(p)}
                disabled={p.newCount === 0 || busy}
                style={{ opacity: (p.newCount === 0 || busy) ? 0.5 : 1 }}
              >
                Import {p.newCount}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'New', value: p.newCount },
              { label: 'Duplicates', value: p.duplicates },
              { label: 'Warnings', value: p.warnings.length },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 14px', borderRadius: 10, background: 'color-mix(in oklab, white 60%, transparent)', border: '1px solid var(--line)' }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>{s.label}</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {p.warnings.length > 0 && (
            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'oklch(55% 0.12 75)', fontWeight: 500 }}>
                Warnings ({p.warnings.length})
              </summary>
              <ul style={{ fontSize: 11, color: 'var(--ink-mute)', paddingLeft: 16, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {p.warnings.slice(0, 50).map((w, j) => <li key={j}>{w}</li>)}
              </ul>
            </details>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="data" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Conf.</th>
                </tr>
              </thead>
              <tbody>
                {p.candidates.slice(0, 25).map(t => (
                  <tr key={t.id}>
                    <td className="mono" style={{ color: 'var(--ink-mute)' }}>{t.date}</td>
                    <td style={{ fontWeight: 500 }}>{t.merchantRaw}</td>
                    <td><span className="chip" style={{ fontSize: 10 }}>{t.type}</span></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtCAD(t.amount)}</td>
                    <td>{t.categoryId ?? <span style={{ color: 'var(--ink-mute)' }}>—</span>}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-mute)' }}>{Math.round(t.categoryConfidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.candidates.length > 25 && (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', padding: '6px 0 0 4px' }}>
                …and {p.candidates.length - 25} more
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Supported banks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {BANKS.map(b => (
          <div key={b.bank} className="glass" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <BankLogo bank={b.bank} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{b.hint}</div>
            </div>
            <span className="chip chip-accent"><Icon name="check" size={10} />Ready</span>
          </div>
        ))}
      </div>

      {/* Recent imports */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Recent imports</div>
          <span className="chip"><Icon name="shield" size={11} />Local-only storage</span>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Bank</th>
              <th>File</th>
              <th style={{ width: 80, textAlign: 'right' }}>Rows</th>
              <th style={{ width: 170 }}>Imported</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-mute)', padding: '24px 0', fontSize: 13 }}>
                  No imports yet
                </td>
              </tr>
            )}
            {batches.map(b => (
              <tr key={b.id}>
                <td><BankLogo bank={b.bank} size={22} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="file" size={14} />
                    <span className="mono" style={{ fontSize: 12 }}>{b.filename}</span>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>{b.count}</td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  {new Date(b.importedAt).toLocaleString()}
                </td>
                <td><span className="chip chip-accent"><Icon name="check" size={10} />Imported</span></td>
                <td>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 4, border: 'none', background: 'transparent' }}
                    title="Undo import"
                    onClick={async () => {
                      if (!window.confirm(`Delete all ${b.count} transactions from this import?`)) return;
                      await db.transactions.where('importBatchId').equals(b.id).delete();
                      await db.importBatches.delete(b.id);
                    }}
                  >
                    <Icon name="more" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
