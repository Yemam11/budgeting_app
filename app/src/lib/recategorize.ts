import { db } from '../db';
import type { Transaction } from '../types';

export async function recategorizeTransaction(
  txId: string,
  newCategoryId: string | null,
  opts: { propagateToMerchant: boolean },
): Promise<{ propagated: number }> {
  const tx = await db.transactions.get(txId);
  if (!tx) return { propagated: 0 };

  let propagated = 0;
  await db.transaction('rw', [db.transactions, db.merchantRules], async () => {
    const patch: Partial<Transaction> = {
      categoryId: newCategoryId,
      categoryConfidence: 1,
      categorySource: 'user',
    };
    await db.transactions.update(txId, patch);

    if (opts.propagateToMerchant && tx.merchantNormalized) {
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
        await db.transactions.update(s.id, {
          categoryId: newCategoryId,
          categoryConfidence: newCategoryId ? 1 : 0,
          categorySource: newCategoryId ? 'merchant-rule' : 'uncategorized',
        });
        propagated++;
      }
    }
  });

  return { propagated };
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
