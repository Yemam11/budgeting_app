import * as XLSX from 'xlsx';
import type { ParseResult, ParsedRow } from './types';
import type { TxType } from '../types';

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
};

export function parseAmex(buffer: ArrayBuffer): ParseResult {
  const warnings: string[] = [];
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('Amex: workbook has no sheets.');

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  let headerRow = -1;
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i].map((c) => String(c ?? '').trim().toLowerCase());
    if (row.includes('date') && row.includes('description') && row.includes('amount')) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error('Amex: could not locate header row (expected Date/Description/Amount).');
  }

  const headers = aoa[headerRow].map((c) => String(c ?? '').trim().toLowerCase());
  const idx = {
    date: headers.indexOf('date'),
    dateProcessed: headers.indexOf('date processed'),
    description: headers.indexOf('description'),
    amount: headers.indexOf('amount'),
    merchant: headers.indexOf('merchant'),
  };

  const rows: ParsedRow[] = [];
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => !c || String(c).trim() === '')) continue;

    const rawDate = String(r[idx.date] ?? '').trim();
    const rawDesc = String(r[idx.description] ?? '').trim();
    const rawMerchant = idx.merchant >= 0 ? String(r[idx.merchant] ?? '').trim() : '';
    const rawAmt = r[idx.amount];

    if (!rawDate || !rawDesc) continue;

    const iso = amexDate(rawDate);
    if (!iso) {
      warnings.push(`Amex: could not parse date "${rawDate}"`);
      continue;
    }

    const amount = amexAmount(rawAmt);
    if (amount === null) {
      warnings.push(`Amex: invalid amount "${String(rawAmt)}" on ${rawDate}`);
      continue;
    }

    let type: TxType = 'spend';
    const descLower = rawDesc.toLowerCase();
    if (descLower.includes('payment received') || descLower.includes('thank you')) {
      type = 'cc-payment';
    }

    const merchantRaw = rawMerchant || rawDesc;

    rows.push({
      bank: 'amex',
      date: iso,
      postedDate: idx.dateProcessed >= 0 ? amexDate(String(r[idx.dateProcessed] ?? '')) ?? undefined : undefined,
      merchantRaw,
      amount,
      type,
      rawRow: { date: rawDate, description: rawDesc, amount: rawAmt, merchant: rawMerchant },
    });
  }

  return { bank: 'amex', rows, warnings };
}

function amexDate(s: string): string | null {
  if (!s) return null;
  const cleaned = s.replace(/\./g, '').trim();
  const m = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const monthKey = m[2].toLowerCase().slice(0, 4);
  const month = MONTHS[monthKey] ?? MONTHS[monthKey.slice(0, 3)];
  if (!month) return null;
  return `${m[3]}-${month}-${day}`;
}

function amexAmount(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).trim().replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
