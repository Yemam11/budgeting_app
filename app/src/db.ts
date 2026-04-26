import type {
  Transaction, Category, MerchantRule, Budget,
  ImportBatch, OutstandingEntry, AppSetting, Contact,
} from './types';

// All API calls go through Vite's proxy → http://localhost:3001
const BASE = '/api';

async function _get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (r.status === 404) {
    const e = new Error('Not found') as Error & { status: number };
    e.status = 404;
    throw e;
  }
  if (!r.ok) throw new Error(`API ${r.status}: GET ${path}`);
  return r.json();
}

async function _post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}: POST ${path}`);
  return r.json();
}

async function _patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${r.status}: PATCH ${path}`);
  return r.json();
}

async function _del(path: string): Promise<void> {
  await fetch(`${BASE}${path}`, { method: 'DELETE' });
}

// Debounce UI invalidation so rapid mutations only trigger one re-fetch
let _invalidateTimer: ReturnType<typeof setTimeout> | null = null;
export function invalidateDb() {
  if (_invalidateTimer) clearTimeout(_invalidateTimer);
  _invalidateTimer = setTimeout(() => {
    window.dispatchEvent(new Event('db-updated'));
    _invalidateTimer = null;
  }, 30);
}

// ---- Query chain helpers ----

class FilterResult<T> {
  constructor(private _source: () => Promise<T[]>) {}
  toArray(): Promise<T[]> { return this._source(); }
  async count(): Promise<number> { return (await this._source()).length; }
}

interface DeletableResult<T> extends FilterResult<T> {
  delete(): Promise<void>;
}

class WhereClause<T> {
  constructor(
    private _source: () => Promise<T[]>,
    private _field: string,
    private _route: string,
  ) {}

  equals(val: unknown): DeletableResult<T> {
    const { _source, _field, _route } = this;
    const result = new FilterResult<T>(() =>
      _source().then(all =>
        all.filter(item => (item as Record<string, unknown>)[_field] === val)
      )
    ) as DeletableResult<T>;
    result.delete = async () => {
      await _del(`/${_route}/where/${encodeURIComponent(_field)}/${encodeURIComponent(String(val))}`);
      invalidateDb();
    };
    return result;
  }

  notEqual(val: unknown): FilterResult<T> {
    const { _source, _field } = this;
    return new FilterResult<T>(() =>
      _source().then(all =>
        all.filter(item => (item as Record<string, unknown>)[_field] !== val)
      )
    );
  }

  anyOf(vals: unknown[]): FilterResult<T> {
    const { _source, _field } = this;
    const set = new Set(vals);
    return new FilterResult<T>(() =>
      _source().then(all =>
        all.filter(item => set.has((item as Record<string, unknown>)[_field]))
      )
    );
  }
}

class OrderResult<T> {
  constructor(
    private _source: () => Promise<T[]>,
    private _field: string,
    private _asc = true,
  ) {}

  toArray(): Promise<T[]> {
    return this._source().then(all => {
      const { _field, _asc } = this;
      return [...all].sort((a, b) => {
        const av = (a as Record<string, unknown>)[_field] as string | number;
        const bv = (b as Record<string, unknown>)[_field] as string | number;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (_asc ? 1 : -1);
      });
    });
  }

  reverse(): OrderResult<T> {
    return new OrderResult(this._source, this._field, !this._asc);
  }
}

// ---- API Table ----

class ApiTable<T, K extends string = string> {
  constructor(private _route: string) {}

  toArray(): Promise<T[]> { return _get<T[]>(`/${this._route}`); }
  count(): Promise<number> { return _get<number>(`/${this._route}/count`); }

  async get(id: K): Promise<T | undefined> {
    try {
      return await _get<T>(`/${this._route}/${encodeURIComponent(id)}`);
    } catch (e) {
      if ((e as { status?: number }).status === 404) return undefined;
      throw e;
    }
  }

  async add(item: T): Promise<K> {
    const { id } = await _post<{ id: K }>(`/${this._route}`, item);
    invalidateDb();
    return id;
  }

  async put(item: T): Promise<K> {
    const { id } = await _post<{ id: K }>(`/${this._route}/upsert`, item);
    invalidateDb();
    return id;
  }

  async update(id: K, patch: Partial<T>): Promise<number> {
    const { updated } = await _patch<{ updated: number }>(`/${this._route}/${encodeURIComponent(id)}`, patch);
    invalidateDb();
    return updated;
  }

  async delete(id: K): Promise<void> {
    await _del(`/${this._route}/${encodeURIComponent(id)}`);
    invalidateDb();
  }

  async bulkAdd(items: T[]): Promise<K> {
    if (!items.length) return '' as K;
    const { lastId } = await _post<{ lastId: K }>(`/${this._route}/bulk-add`, items);
    invalidateDb();
    return lastId;
  }

  async bulkPut(items: T[]): Promise<K[]> {
    if (!items.length) return [];
    const { ids } = await _post<{ ids: K[] }>(`/${this._route}/bulk-put`, items);
    invalidateDb();
    return ids;
  }

  async clear(): Promise<void> {
    await _del(`/${this._route}`);
    invalidateDb();
  }

  where(field: string): WhereClause<T> {
    return new WhereClause<T>(() => this.toArray(), field, this._route);
  }

  orderBy(field: string): OrderResult<T> {
    return new OrderResult<T>(() => this.toArray(), field);
  }

  filter(fn: (item: T) => boolean): FilterResult<T> {
    return new FilterResult<T>(() => this.toArray().then(all => all.filter(fn)));
  }
}

// ---- Database ----

class BudgetDb {
  transactions  = new ApiTable<Transaction>('transactions');
  categories    = new ApiTable<Category>('categories');
  merchantRules = new ApiTable<MerchantRule, string>('merchant-rules');
  budgets       = new ApiTable<Budget, string>('budgets');
  importBatches = new ApiTable<ImportBatch>('import-batches');
  outstanding   = new ApiTable<OutstandingEntry>('outstanding');
  settings      = new ApiTable<AppSetting, string>('settings');
  contacts      = new ApiTable<Contact>('contacts');

  // No real transaction support over HTTP; run the callback and let mutations
  // batch their own invalidations via the debounce in invalidateDb().
  async transaction(_mode: string, _tables: unknown[], callback: () => Promise<void>): Promise<void> {
    await callback();
  }

  async delete(): Promise<void> {
    await _del('/all');
    invalidateDb();
  }
}

export const db = new BudgetDb();
export type { BudgetDb };
