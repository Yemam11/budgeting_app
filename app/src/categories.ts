import type { Category } from './types';

export const SEED_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', color: '#16a34a', order: 10 },
  { id: 'gas', name: 'Gas', color: '#ea580c', order: 20 },
  { id: 'transportation', name: 'Transportation', color: '#c2410c', order: 25 },
  { id: 'bills-utilities', name: 'Bills & Utilities', color: '#0369a1', order: 30 },
  { id: 'subscription', name: 'Subscription', color: '#0891b2', order: 40 },
  { id: 'food', name: 'Food', color: '#dc2626', order: 50 },
  { id: 'cafe', name: 'Café', color: '#b45309', order: 60 },
  { id: 'entertainment', name: 'Entertainment', color: '#9333ea', order: 70 },
  { id: 'lifestyle', name: 'Lifestyle', color: '#db2777', order: 80 },
  { id: 'clothing', name: 'Clothing', color: '#e11d48', order: 90 },
  { id: 'online-purchase', name: 'Online Purchase', color: '#6366f1', order: 100 },
  { id: 'health-medical', name: 'Health/Medical', color: '#059669', order: 110 },
  { id: 'investment', name: 'Investment', color: '#1e40af', order: 120 },
  { id: 'charity', name: 'Charity', color: '#a16207', order: 130 },
  { id: 'gift', name: 'Gift', color: '#be185d', order: 140 },
  { id: 'one-time-misc', name: 'One-time Misc', color: '#78716c', order: 150 },
  { id: 'other', name: 'Other', color: '#64748b', order: 160 },
  { id: 'income', name: 'Income', color: '#15803d', order: 200, isIncome: true },
];

export const INCOME_CATEGORY_ID = 'income';
export const UNCATEGORIZED_LABEL = 'Uncategorized';
