import Papa from 'papaparse';
import type { ParseResult, ParsedRow } from './types';
import type { TxType } from '../types';

export function parseBmo(csvText: string): ParseResult {
  const warnings: string[] = [];
  const lines = csvText.split(/\r?\n/);

  let headerIdx = lines.findIndex((l) => l.toLowerCase().includes('item #') && l.toLowerCase().includes('transaction amount'));
  if (headerIdx < 0) {
    throw new Error('BMO: could not locate header row (expected "Item #,Card #,Transaction Date,...").');
  }

  const body = lines.slice(headerIdx).join('\n');
  const parsed = Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedRow[] = [];
  for (const rec of parsed.data) {
    const tdate = rec['Transaction Date'];
    const pdate = rec['Posting Date'];
    const amt = rec['Transaction Amount'];
    const desc = rec['Description'];
    if (!tdate || !amt || !desc) continue;

    const amount = parseFloat(amt);
    if (Number.isNaN(amount)) {
      warnings.push(`BMO: invalid amount "${amt}" on ${tdate}`);
      continue;
    }

    const dateIso = bmoDate(tdate);
    if (!dateIso) {
      warnings.push(`BMO: invalid date "${tdate}"`);
      continue;
    }

    let type: TxType = 'spend';
    const descLower = desc.toLowerCase();
    if (descLower.includes('payment received') || descLower.includes('thank you') || amount < 0) {
      type = amount < 0 ? 'cc-payment' : 'spend';
    }

    rows.push({
      bank: 'bmo',
      date: dateIso,
      postedDate: bmoDate(pdate) ?? undefined,
      merchantRaw: desc.trim(),
      amount,
      type,
      rawRow: rec,
    });
  }

  return { bank: 'bmo', rows, warnings };
}

function bmoDate(s: string | undefined): string | null {
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
