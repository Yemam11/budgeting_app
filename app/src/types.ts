export type Bank = 'amex' | 'bmo' | 'scotia' | 'simplii' | 'cibc';

export type TxType = 'spend' | 'income' | 'transfer' | 'cc-payment' | 'savings' | 'investment';

export type CategorySource = 'user' | 'merchant-rule' | 'seed-rule' | 'uncategorized';

export interface SplitInfo {
  people: number;
  myShare: number;
  perPerson?: { name: string; amount: number }[];
  originalAmount: number;
}

export interface Transaction {
  id: string;
  bank: Bank;
  importBatchId: string;
  date: string;
  postedDate?: string;
  merchantRaw: string;
  merchantNormalized: string;
  amount: number;
  categoryId: string | null;
  categoryConfidence: number;
  categorySource: CategorySource;
  type: TxType;
  split?: SplitInfo;
  spreadMonths?: number;
  notes?: string;
  hidden?: boolean;
  owner?: string | null;
  envelopeId?: string | null;
  investmentAccount?: string | null;
  dedupeKey: string;
  rawRow?: Record<string, unknown>;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  archived?: boolean;
  order: number;
  isIncome?: boolean;
}

export interface MerchantRule {
  merchantNormalized: string;
  categoryId: string;
  source: 'user' | 'seed';
  hitCount: number;
  lastUpdated: number;
}

export interface Budget {
  categoryId: string;
  monthlyLimit: number;
}

export interface ImportBatch {
  id: string;
  bank: Bank;
  filename: string;
  importedAt: number;
  count: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface OutstandingEntry {
  id: string;
  transactionId: string;
  personName: string;
  amount: number;
  createdAt: number;
  status: 'outstanding' | 'proposed-settled' | 'settled';
  settledByTransactionId?: string;
  settledAt?: number;
}

export interface Contact {
  id: string;
  name: string;
  createdAt: number;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export interface Person {
  id: string;
  name: string;
  createdAt: number;
}

export interface CategoryForward {
  fromCategoryId: string;
  toCategoryId: string;
}

export interface Envelope {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  pct: number;
  color: string;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  institution: string;
  marketValue: number | null;
  roomLeft?: number;
}

export type AmountOp = '>' | '<' | '>=' | '<=' | '=';

export interface CustomRule {
  id: string;
  name: string;
  // Conditions (all present ones must match)
  merchantContains?: string;
  amountOp?: AmountOp;
  amountValue?: number;
  // Action (at least one)
  targetType?: TxType;
  targetCategoryId?: string;
  priority: number;
  createdAt: number;
}
