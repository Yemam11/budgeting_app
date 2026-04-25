import { parseAmex } from './amex';
import { parseBmo } from './bmo';
import { parseScotia } from './scotia';
import type { ParseResult } from './types';

export async function parseFile(file: File): Promise<ParseResult> {
  const lower = file.name.toLowerCase();
  const isXls = lower.endsWith('.xls') || lower.endsWith('.xlsx');

  if (isXls) {
    const buf = await file.arrayBuffer();
    return parseAmex(buf);
  }

  const text = await file.text();
  const firstLines = text.slice(0, 2000).toLowerCase();

  if (firstLines.includes('item #') && firstLines.includes('transaction amount')) {
    return parseBmo(text);
  }

  if (firstLines.includes('filter') && firstLines.includes('sub-description')) {
    return parseScotia(text);
  }

  if (firstLines.includes('date') && firstLines.includes('description') && firstLines.includes('amount')) {
    throw new Error(
      `Could not confidently detect bank format for "${file.name}". Expected BMO (Item #,Transaction Date...) or Scotia (Filter,Date,Description,Sub-description...) CSV, or Amex .xls.`,
    );
  }

  throw new Error(`Unknown file format: ${file.name}`);
}

export { parseAmex, parseBmo, parseScotia };
export type { ParseResult, ParsedRow } from './types';
