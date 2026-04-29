import Papa from 'papaparse';
import type { ParseResult, ParsedRow } from './types';
import type { TxType } from '../types';

export function parseSimlii(csvText: string): ParseResult {
  const warnings: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: ParsedRow[] = [];
  for (const rec of parsed.data) {
    const dateStr = rec['Date'];
    const details = (rec['Transaction Details'] ?? '').trim();
    const fundsOutStr = (rec['Funds Out'] ?? '').trim();
    const fundsInStr = (rec['Funds In'] ?? '').trim();

    if (!dateStr || !details) continue;

    const dateIso = simpliiDate(dateStr);
    if (!dateIso) {
      warnings.push(`Simplii: invalid date "${dateStr}"`);
      continue;
    }

    let amount: number;
    let type: TxType;

    if (fundsOutStr) {
      const n = parseFloat(fundsOutStr);
      if (Number.isNaN(n)) {
        warnings.push(`Simplii: invalid Funds Out "${fundsOutStr}" on ${dateStr}`);
        continue;
      }
      amount = n;
      type = 'spend';
    } else if (fundsInStr) {
      const n = parseFloat(fundsInStr);
      if (Number.isNaN(n)) {
        warnings.push(`Simplii: invalid Funds In "${fundsInStr}" on ${dateStr}`);
        continue;
      }
      amount = -n;
      type = 'cc-payment';
    } else {
      warnings.push(`Simplii: row on ${dateStr} has no amount`);
      continue;
    }

    rows.push({
      bank: 'simplii',
      date: dateIso,
      merchantRaw: details,
      amount,
      type,
      rawRow: rec,
    });
  }

  return { bank: 'simplii', rows, warnings };
}

function simpliiDate(s: string): string | null {
  // MM/DD/YYYY → YYYY-MM-DD
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}
