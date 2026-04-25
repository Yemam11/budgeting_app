import Papa from 'papaparse';
import type { ParseResult, ParsedRow } from './types';
import type { TxType } from '../types';

export function parseScotia(csvText: string): ParseResult {
  const warnings: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedRow[] = [];
  for (const rec of parsed.data) {
    const date = rec['Date'];
    const desc = (rec['Description'] ?? '').trim();
    const subDesc = (rec['Sub-description'] ?? '').trim();
    const amtStr = rec['Amount'];

    if (!date || !amtStr) continue;
    const amt = parseFloat(amtStr);
    if (Number.isNaN(amt)) {
      warnings.push(`Scotia: invalid amount "${amtStr}" on ${date}`);
      continue;
    }

    const type = classifyScotia(desc, subDesc);
    const merchantRaw = subDesc || desc;
    const descForCat = [desc, subDesc].filter(Boolean).join(' ');

    rows.push({
      bank: 'scotia',
      date,
      merchantRaw,
      descriptionForCategorization: descForCat,
      amount: -amt,
      type,
      rawRow: rec,
    });
  }

  return { bank: 'scotia', rows, warnings };
}

function classifyScotia(desc: string, subDesc: string): TxType {
  const d = desc.toLowerCase();
  const s = subDesc.toLowerCase();

  if (d.includes('customer transfer')) {
    if (s.includes('investment')) return 'spend';
    return 'transfer';
  }

  if (d.includes('miscellaneous payment') || d.includes('bill payment')) {
    if (
      s.includes('american express') ||
      s.includes('amex') ||
      s.includes('mastercard') ||
      s.includes('visa') ||
      s.includes('bmo mastercard') ||
      s.includes('bmo master') ||
      s.includes('tangerine credit') ||
      s.includes('rogers bank')
    ) {
      return 'cc-payment';
    }
  }

  if (d.includes('payroll')) return 'income';
  if (d === 'deposit') return 'income';
  if (d.includes('provincial payment')) return 'income';
  if (d.includes('gst')) return 'income';
  if (d === 'refund') return 'income';
  if (d.includes('cra deposit')) return 'income';

  return 'spend';
}
