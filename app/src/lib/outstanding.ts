import { db } from '../db';
import type { OutstandingEntry, Transaction } from '../types';

const MATCH_WINDOW_DAYS = 45;
const AMOUNT_TOLERANCE = 0.01;

export interface MatchProposal {
  entry: OutstandingEntry;
  transaction: Transaction;
  daysAfter: number;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export async function findMatchProposals(): Promise<MatchProposal[]> {
  const outstanding = await db.outstanding
    .where('status')
    .anyOf(['outstanding', 'proposed-settled'])
    .toArray();
  if (outstanding.length === 0) return [];

  const inflows = await db.transactions
    .filter((t) =>
      (t.type === 'income' || (t.type === 'spend' && t.amount < 0)) &&
      !t.hidden,
    )
    .toArray();

  const alreadyUsed = new Set(
    outstanding.filter((o) => o.settledByTransactionId).map((o) => o.settledByTransactionId!),
  );

  const proposals: MatchProposal[] = [];

  for (const entry of outstanding) {
    const sourceTx = await db.transactions.get(entry.transactionId);
    if (!sourceTx) continue;

    for (const tx of inflows) {
      if (alreadyUsed.has(tx.id)) continue;
      const inflowAmount = Math.abs(tx.amount);
      if (Math.abs(inflowAmount - entry.amount) > AMOUNT_TOLERANCE) continue;

      const delta = daysBetween(sourceTx.date, tx.date);
      if (delta < 0 || delta > MATCH_WINDOW_DAYS) continue;

      proposals.push({ entry, transaction: tx, daysAfter: delta });
      break;
    }
  }

  return proposals;
}

export async function confirmSettlement(entryId: string, transactionId: string): Promise<void> {
  await db.outstanding.update(entryId, {
    status: 'settled',
    settledByTransactionId: transactionId,
    settledAt: Date.now(),
  });
}

export async function dismissProposal(entryId: string): Promise<void> {
  await db.outstanding.update(entryId, {
    status: 'outstanding',
    settledByTransactionId: undefined,
  });
}

export async function manuallySettle(entryId: string): Promise<void> {
  await db.outstanding.update(entryId, { status: 'settled', settledAt: Date.now() });
}
