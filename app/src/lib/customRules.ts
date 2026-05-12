import type { CustomRule, Transaction } from '../types';

export function matchesCustomRule(rule: CustomRule, tx: Pick<Transaction, 'merchantRaw' | 'merchantNormalized' | 'amount'>): boolean {
  if (rule.merchantContains) {
    const needle = rule.merchantContains.toLowerCase();
    const inRaw  = tx.merchantRaw.toLowerCase().includes(needle);
    const inNorm = tx.merchantNormalized.toLowerCase().includes(needle);
    if (!inRaw && !inNorm) return false;
  }

  if (rule.amountOp !== undefined && rule.amountValue !== undefined) {
    const abs = Math.abs(tx.amount);
    switch (rule.amountOp) {
      case '>':  if (!(abs >  rule.amountValue)) return false; break;
      case '<':  if (!(abs <  rule.amountValue)) return false; break;
      case '>=': if (!(abs >= rule.amountValue)) return false; break;
      case '<=': if (!(abs <= rule.amountValue)) return false; break;
      case '=':  if (  abs !== rule.amountValue)  return false; break;
    }
  }

  return true;
}

export function applyCustomRules(
  rules: CustomRule[],
  tx: Transaction,
): Partial<Transaction> | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (!matchesCustomRule(rule, tx)) continue;
    const patch: Partial<Transaction> = {};
    if (rule.targetType) {
      patch.type = rule.targetType;
      const nonCat = ['transfer', 'cc-payment', 'savings', 'investment'] as const;
      if (nonCat.includes(rule.targetType as (typeof nonCat)[number])) {
        patch.categoryId = null;
      }
      if (rule.targetType !== 'investment') patch.investmentAccount = null;
    }
    if (rule.targetCategoryId) {
      patch.categoryId = rule.targetCategoryId;
      patch.categorySource = 'user';
      patch.categoryConfidence = 1;
    }
    return patch;
  }
  return null;
}
