import type { MerchantRule, Transaction, TxType } from '../types';
import { SEED_RULES } from './seedRules';

export interface Categorization {
  categoryId: string | null;
  confidence: number;
  source: Transaction['categorySource'];
}

export function categorize(
  merchantNormalized: string,
  descriptionRaw: string,
  type: TxType,
  merchantRules: Map<string, MerchantRule>,
): Categorization {
  if (type === 'transfer' || type === 'cc-payment') {
    return { categoryId: null, confidence: 1, source: 'seed-rule' };
  }

  if (type === 'income') {
    return { categoryId: 'income', confidence: 1, source: 'seed-rule' };
  }

  const direct = merchantRules.get(merchantNormalized);
  if (direct) {
    const conf = Math.min(1, 0.85 + Math.log10(1 + direct.hitCount) * 0.05);
    return {
      categoryId: direct.categoryId,
      confidence: direct.source === 'user' ? 1 : conf,
      source: direct.source === 'user' ? 'user' : 'merchant-rule',
    };
  }

  const haystack = (descriptionRaw + ' ' + merchantNormalized).toLowerCase();
  for (const rule of SEED_RULES) {
    for (const pattern of rule.patterns) {
      if (haystack.includes(pattern)) {
        return { categoryId: rule.categoryId, confidence: 0.7, source: 'seed-rule' };
      }
    }
  }

  return { categoryId: null, confidence: 0, source: 'uncategorized' };
}
