import { db } from '../db';
import { SEED_CATEGORIES } from '../categories';

export async function ensureSeeded(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) return;
  await db.categories.bulkAdd(SEED_CATEGORIES);
}
