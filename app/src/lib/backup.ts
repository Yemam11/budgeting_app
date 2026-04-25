import { db } from '../db';

export async function exportAll(): Promise<string> {
  const [transactions, categories, merchantRules, budgets, importBatches, outstanding, settings] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.merchantRules.toArray(),
    db.budgets.toArray(),
    db.importBatches.toArray(),
    db.outstanding.toArray(),
    db.settings.toArray(),
  ]);
  return JSON.stringify(
    { v: 1, exportedAt: new Date().toISOString(), transactions, categories, merchantRules, budgets, importBatches, outstanding, settings },
    null,
    2,
  );
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (!data || data.v !== 1) throw new Error('Backup file: unsupported version.');
  await db.transaction(
    'rw',
    [db.transactions, db.categories, db.merchantRules, db.budgets, db.importBatches, db.outstanding, db.settings],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.merchantRules.clear(),
        db.budgets.clear(),
        db.importBatches.clear(),
        db.outstanding.clear(),
        db.settings.clear(),
      ]);
      await db.transactions.bulkAdd(data.transactions ?? []);
      await db.categories.bulkAdd(data.categories ?? []);
      await db.merchantRules.bulkAdd(data.merchantRules ?? []);
      await db.budgets.bulkAdd(data.budgets ?? []);
      await db.importBatches.bulkAdd(data.importBatches ?? []);
      await db.outstanding.bulkAdd(data.outstanding ?? []);
      await db.settings.bulkAdd(data.settings ?? []);
    },
  );
}

export async function wipeAll(): Promise<void> {
  await db.delete();
  window.location.reload();
}
