import { nanoid } from 'nanoid';
import { db } from '../db';
import type { Transaction, MerchantRule, ImportBatch } from '../types';
import { parseFile } from '../parsers';
import type { ParseResult } from '../parsers';
import { normalizeMerchant, makeDedupeKey } from './normalize';
import { categorize } from './categorizer';

function resolveCategoryForward(catId: string | null, forwards: Map<string, string>): string | null {
  if (!catId || !forwards.size) return catId;
  const seen = new Set<string>();
  let cur = catId;
  while (forwards.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = forwards.get(cur)!;
  }
  return cur;
}

export interface ImportPreview {
  filename: string;
  parseResult: ParseResult;
  candidates: Transaction[];
  duplicates: number;
  duplicateRows: Transaction[];
  newCount: number;
  warnings: string[];
}

export async function buildPreview(file: File): Promise<ImportPreview> {
  const parseResult = await parseFile(file);

  const existingKeys = new Set<string>(
    (await db.transactions.toArray()).map((t) => t.dedupeKey),
  );

  const merchantRulesArr = await db.merchantRules.toArray();
  const merchantRules = new Map<string, MerchantRule>(
    merchantRulesArr.map((r) => [r.merchantNormalized, r]),
  );

  const categoryForwardsArr = await db.categoryForwards.toArray();
  const categoryForwards = new Map<string, string>(
    categoryForwardsArr.map((f) => [f.fromCategoryId, f.toCategoryId]),
  );

  const batchId = nanoid();
  const candidates: Transaction[] = [];
  const duplicateRows: Transaction[] = [];
  const dupSet = new Set<string>();
  let duplicates = 0;

  for (const r of parseResult.rows) {
    const merchantNormalized = normalizeMerchant(r.merchantRaw);
    const dedupeKey = makeDedupeKey({
      bank: r.bank,
      date: r.date,
      amount: r.amount,
      rawDesc: r.merchantRaw,
    });

    const descForCat = r.descriptionForCategorization ?? r.merchantRaw;
    const catRaw = categorize(merchantNormalized, descForCat, r.type, merchantRules);
    const resolvedCatId = resolveCategoryForward(catRaw.categoryId, categoryForwards);
    const cat = resolvedCatId !== catRaw.categoryId ? { ...catRaw, categoryId: resolvedCatId } : catRaw;
    const tx: Transaction = {
      id: nanoid(),
      bank: r.bank,
      importBatchId: batchId,
      date: r.date,
      postedDate: r.postedDate,
      merchantRaw: r.merchantRaw,
      merchantNormalized,
      amount: r.amount,
      categoryId: cat.categoryId,
      categoryConfidence: cat.confidence,
      categorySource: cat.source,
      type: r.type,
      dedupeKey,
      rawRow: r.rawRow,
    };

    if (existingKeys.has(dedupeKey) || dupSet.has(dedupeKey)) {
      duplicates++;
      duplicateRows.push(tx);
      continue;
    }
    dupSet.add(dedupeKey);
    candidates.push(tx);
  }

  return {
    filename: file.name,
    parseResult,
    candidates,
    duplicates,
    duplicateRows,
    newCount: candidates.length,
    warnings: parseResult.warnings,
  };
}

export async function commitImport(preview: ImportPreview): Promise<void> {
  if (preview.candidates.length === 0) return;

  const dates = preview.candidates.map(t => t.date).sort();
  const batch: ImportBatch = {
    id: preview.candidates[0].importBatchId,
    bank: preview.parseResult.bank,
    filename: preview.filename,
    importedAt: Date.now(),
    count: preview.candidates.length,
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
  };

  await db.transaction(
    'rw',
    [db.transactions, db.importBatches, db.merchantRules],
    async () => {
      await db.importBatches.add(batch);
      await db.transactions.bulkAdd(preview.candidates);

      const updates: Record<string, MerchantRule> = {};
      for (const t of preview.candidates) {
        if (!t.merchantNormalized || !t.categoryId) continue;
        if (t.categorySource !== 'merchant-rule' && t.categorySource !== 'user') continue;
        const existing = updates[t.merchantNormalized] ?? (await db.merchantRules.get(t.merchantNormalized));
        if (existing) {
          updates[t.merchantNormalized] = {
            ...existing,
            hitCount: (existing.hitCount ?? 0) + 1,
            lastUpdated: Date.now(),
          };
        }
      }
      if (Object.keys(updates).length) {
        await db.merchantRules.bulkPut(Object.values(updates));
      }
    },
  );
}
