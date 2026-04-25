import { nanoid } from 'nanoid';
import { db } from '../db';
import type { SplitInfo, Transaction, OutstandingEntry } from '../types';

export interface EvenSplitInput {
  totalPeople: number;
  otherPeople: string[];
}

export interface CustomSplitInput {
  myAmount: number;
  others: { name: string; amount: number }[];
}

export async function applyEvenSplit(txId: string, input: EvenSplitInput): Promise<void> {
  const tx = await db.transactions.get(txId);
  if (!tx) return;
  if (input.totalPeople < 2) {
    await clearSplit(txId);
    return;
  }

  const original = tx.split?.originalAmount ?? tx.amount;
  const myShare = round2(original / input.totalPeople);
  const perPersonAmount = round2(original / input.totalPeople);

  const split: SplitInfo = {
    people: input.totalPeople,
    myShare,
    originalAmount: original,
    perPerson: input.otherPeople.slice(0, input.totalPeople - 1).map((name) => ({
      name: name.trim() || 'Unnamed',
      amount: perPersonAmount,
    })),
  };

  await db.transaction('rw', [db.transactions, db.outstanding], async () => {
    await db.transactions.update(txId, { amount: myShare, split });
    await regenerateOutstanding(tx, split);
  });
}

export async function applyCustomSplit(txId: string, input: CustomSplitInput): Promise<void> {
  const tx = await db.transactions.get(txId);
  if (!tx) return;
  const original = tx.split?.originalAmount ?? tx.amount;
  const totalOthers = input.others.reduce((s, p) => s + p.amount, 0);
  const total = round2(input.myAmount + totalOthers);
  if (Math.abs(total - original) > 0.02) {
    throw new Error(`Split amounts ($${total.toFixed(2)}) do not add up to original ($${original.toFixed(2)}).`);
  }

  const split: SplitInfo = {
    people: 1 + input.others.length,
    myShare: round2(input.myAmount),
    originalAmount: original,
    perPerson: input.others.map((p) => ({ name: p.name.trim() || 'Unnamed', amount: round2(p.amount) })),
  };

  await db.transaction('rw', [db.transactions, db.outstanding], async () => {
    await db.transactions.update(txId, { amount: split.myShare, split });
    await regenerateOutstanding(tx, split);
  });
}

export async function clearSplit(txId: string): Promise<void> {
  const tx = await db.transactions.get(txId);
  if (!tx) return;
  await db.transaction('rw', [db.transactions, db.outstanding], async () => {
    const original = tx.split?.originalAmount ?? tx.amount;
    await db.transactions.update(txId, { amount: original, split: undefined });
    const entries = await db.outstanding.where('transactionId').equals(txId).toArray();
    for (const e of entries) {
      if (e.status === 'settled') continue;
      await db.outstanding.delete(e.id);
    }
  });
}

async function regenerateOutstanding(tx: Transaction, split: SplitInfo): Promise<void> {
  const existing = await db.outstanding.where('transactionId').equals(tx.id).toArray();
  for (const e of existing) {
    if (e.status !== 'settled') await db.outstanding.delete(e.id);
  }

  const people = split.perPerson ?? [];
  for (const p of people) {
    if (!p.name || p.amount <= 0) continue;
    const entry: OutstandingEntry = {
      id: nanoid(),
      transactionId: tx.id,
      personName: p.name,
      amount: p.amount,
      createdAt: Date.now(),
      status: 'outstanding',
    };
    await db.outstanding.add(entry);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
