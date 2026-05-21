import { db } from '../db';
import { SEED_CATEGORIES } from '../categories';

export async function ensureSeeded(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) {
    const hasSavingsTransfer = await db.categories.get('savings-transfer');
    if (!hasSavingsTransfer) {
      await db.categories.put({ id: 'savings-transfer', name: 'Savings Transfer', color: 'oklch(60% 0.16 210)', order: 122 });
    }
    return;
  }
  await db.categories.bulkAdd(SEED_CATEGORIES);
}
