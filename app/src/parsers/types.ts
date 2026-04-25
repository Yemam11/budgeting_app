import type { Bank, TxType } from '../types';

export interface ParsedRow {
  bank: Bank;
  date: string;
  postedDate?: string;
  merchantRaw: string;
  /** Full text used for seed-rule keyword matching. Defaults to merchantRaw if omitted. */
  descriptionForCategorization?: string;
  amount: number;
  type: TxType;
  rawRow: Record<string, unknown>;
}

export interface ParseResult {
  bank: Bank;
  rows: ParsedRow[];
  warnings: string[];
}
