import { db } from '../db';
import type { CategorySource, MerchantRule } from '../types';

interface TxSnapshot {
  id: string;
  categoryId: string | null;
  categoryConfidence: number;
  categorySource: CategorySource;
}

export interface UndoData {
  txSnapshots: TxSnapshot[];
  prevRule: MerchantRule | null;
  merchantNormalized: string | null;
}

export async function recategorizeTransaction(
  txId: string,
  newCategoryId: string | null,
  opts: { propagateToMerchant: boolean },
): Promise<{ propagated: number; undo: UndoData }> {
  const tx = await db.transactions.get(txId);
  if (!tx) return { propagated: 0, undo: { txSnapshots: [], prevRule: null, merchantNormalized: null } };

  let propagated = 0;
  const snapshots: TxSnapshot[] = [];
  let prevRule: MerchantRule | null = null;

  await db.transaction('rw', [db.transactions, db.merchantRules], async () => {
    snapshots.push({
      id: txId,
      categoryId: tx.categoryId,
      categoryConfidence: tx.categoryConfidence,
      categorySource: tx.categorySource,
    });

    await db.transactions.update(txId, {
      categoryId: newCategoryId,
      categoryConfidence: 1,
      categorySource: 'user',
    });

    if (opts.propagateToMerchant && tx.merchantNormalized) {
      prevRule = (await db.merchantRules.get(tx.merchantNormalized)) ?? null;

      if (newCategoryId) {
        await db.merchantRules.put({
          merchantNormalized: tx.merchantNormalized,
          categoryId: newCategoryId,
          source: 'user',
          hitCount: 1,
          lastUpdated: Date.now(),
        });
      } else {
        await db.merchantRules.delete(tx.merchantNormalized);
      }

      const siblings = await db.transactions
        .where('merchantNormalized')
        .equals(tx.merchantNormalized)
        .toArray();

      for (const s of siblings) {
        if (s.id === txId) continue;
        if (s.categorySource === 'user') continue;
        snapshots.push({
          id: s.id,
          categoryId: s.categoryId,
          categoryConfidence: s.categoryConfidence,
          categorySource: s.categorySource,
        });
        await db.transactions.update(s.id, {
          categoryId: newCategoryId,
          categoryConfidence: newCategoryId ? 1 : 0,
          categorySource: newCategoryId ? 'merchant-rule' : 'uncategorized',
        });
        propagated++;
      }
    }
  });

  return {
    propagated,
    undo: {
      txSnapshots: snapshots,
      prevRule,
      merchantNormalized: opts.propagateToMerchant ? (tx.merchantNormalized || null) : null,
    },
  };
}

export async function undoRecategorize(undo: UndoData): Promise<void> {
  await db.transaction('rw', [db.transactions, db.merchantRules], async () => {
    for (const snap of undo.txSnapshots) {
      await db.transactions.update(snap.id, {
        categoryId: snap.categoryId,
        categoryConfidence: snap.categoryConfidence,
        categorySource: snap.categorySource,
      });
    }
    if (undo.merchantNormalized) {
      if (undo.prevRule) {
        await db.merchantRules.put(undo.prevRule);
      } else {
        await db.merchantRules.delete(undo.merchantNormalized);
      }
    }
  });
}

export async function bulkRecategorizeByCategory(
  fromCategoryId: string | null,
  toCategoryId: string | null,
): Promise<number> {
  let count = 0;
  await db.transaction('rw', [db.transactions], async () => {
    const txs = fromCategoryId
      ? await db.transactions.where('categoryId').equals(fromCategoryId).toArray()
      : await db.transactions.filter((t) => t.categoryId == null).toArray();
    for (const t of txs) {
      await db.transactions.update(t.id, {
        categoryId: toCategoryId,
        categoryConfidence: toCategoryId ? 1 : 0,
        categorySource: toCategoryId ? 'user' : 'uncategorized',
      });
      count++;
    }
  });
  return count;
}
