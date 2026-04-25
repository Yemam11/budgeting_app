import Dexie, { type Table } from 'dexie';
import type {
  Transaction,
  Category,
  MerchantRule,
  Budget,
  ImportBatch,
  OutstandingEntry,
  AppSetting,
} from './types';

export class BudgetDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  merchantRules!: Table<MerchantRule, string>;
  budgets!: Table<Budget, string>;
  importBatches!: Table<ImportBatch, string>;
  outstanding!: Table<OutstandingEntry, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('budget-db');
    this.version(1).stores({
      transactions:
        'id, bank, date, merchantNormalized, categoryId, type, dedupeKey, importBatchId',
      categories: 'id, name, order',
      merchantRules: 'merchantNormalized, categoryId',
      budgets: 'categoryId',
      importBatches: 'id, importedAt',
      outstanding: 'id, status, personName, transactionId, amount',
      settings: 'key',
    });
  }
}

export const db = new BudgetDB();
