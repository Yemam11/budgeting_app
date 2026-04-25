import type { Transaction } from '../types';

export function fmtCAD(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function prevMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

export function isSpend(tx: Transaction): boolean {
  return tx.type === 'spend' && !tx.hidden;
}

export function isIncome(tx: Transaction): boolean {
  return tx.type === 'income' && !tx.hidden;
}

export function categoryTotals(txs: Transaction[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (!isSpend(t)) continue;
    const key = t.categoryId ?? '__uncategorized';
    m.set(key, (m.get(key) ?? 0) + t.amount);
  }
  return m;
}

export function totalSpend(txs: Transaction[]): number {
  let total = 0;
  for (const t of txs) if (isSpend(t)) total += t.amount;
  return total;
}

export function totalIncome(txs: Transaction[]): number {
  let total = 0;
  for (const t of txs) if (isIncome(t)) total += -t.amount;
  return total;
}

export function txsInMonth(txs: Transaction[], key: string): Transaction[] {
  return txs.filter((t) => monthKey(t.date) === key);
}

export function lastNMonths(n: number, today = new Date()): string[] {
  const keys: string[] = [];
  let k = currentMonthKey(today);
  for (let i = 0; i < n; i++) {
    keys.unshift(k);
    k = prevMonth(k);
  }
  return keys;
}
