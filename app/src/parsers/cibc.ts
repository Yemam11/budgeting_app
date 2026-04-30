import Papa from 'papaparse';
import type { ParseResult, ParsedRow } from './types';
import type { TxType } from '../types';

export function parseCibc(csvText: string): ParseResult {
  const warnings: string[] = [];
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const rows: ParsedRow[] = [];
  for (const rec of parsed.data) {
    const dateStr = rec[0]?.trim();
    const details = rec[1]?.trim();
    const fundsOutStr = rec[2]?.trim();
    const fundsInStr = rec[3]?.trim();

    if (!dateStr || !details) continue;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      warnings.push(`CIBC: invalid date "${dateStr}"`);
      continue;
    }

    let amount: number;
    let type: TxType;
    const detailsLower = details.toLowerCase();

    if (fundsOutStr) {
      const n = parseFloat(fundsOutStr);
      if (Number.isNaN(n)) {
        warnings.push(`CIBC: invalid Funds Out "${fundsOutStr}" on ${dateStr}`);
        continue;
      }
      amount = n;
      type = 'spend';
    } else if (fundsInStr) {
      const n = parseFloat(fundsInStr);
      if (Number.isNaN(n)) {
        warnings.push(`CIBC: invalid Funds In "${fundsInStr}" on ${dateStr}`);
        continue;
      }
      if (detailsLower.includes('cashback') || detailsLower.includes('remise en argent')) {
        amount = n;
        type = 'income';
      } else if (detailsLower.includes('payment') || detailsLower.includes('paiemen')) {
        amount = -n;
        type = 'cc-payment';
      } else {
        // Refund or other credit — treat as negative spend
        amount = -n;
        type = 'spend';
      }
    } else {
      warnings.push(`CIBC: row on ${dateStr} has no amount`);
      continue;
    }

    rows.push({
      bank: 'cibc',
      date: dateStr,
      merchantRaw: details,
      amount,
      type,
      rawRow: { date: dateStr, details, fundsOut: fundsOutStr, fundsIn: fundsInStr },
    });
  }

  return { bank: 'cibc', rows, warnings };
}
