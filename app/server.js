import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, '..', 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const sqldb = new DatabaseSync(join(DATA_DIR, 'budget.db'));
sqldb.exec('PRAGMA journal_mode = WAL;');
try { sqldb.exec('ALTER TABLE transactions ADD COLUMN spreadMonths INTEGER'); } catch {}
try { sqldb.exec('ALTER TABLE transactions ADD COLUMN owner TEXT'); } catch {}
try { sqldb.exec('ALTER TABLE transactions ADD COLUMN envelopeId TEXT'); } catch {}
try { sqldb.exec('ALTER TABLE transactions ADD COLUMN investmentAccount TEXT'); } catch {}
try { sqldb.exec('ALTER TABLE transactions ADD COLUMN holdingLogged INTEGER DEFAULT 0'); } catch {}
sqldb.exec(`CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  ticker TEXT NOT NULL,
  shares REAL NOT NULL DEFAULT 0
);`);

sqldb.exec(`CREATE TABLE IF NOT EXISTS custom_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  merchantContains TEXT,
  amountOp TEXT,
  amountValue REAL,
  targetType TEXT,
  targetCategoryId TEXT,
  priority INTEGER DEFAULT 0,
  createdAt INTEGER
);`);

sqldb.exec(`
  CREATE TABLE IF NOT EXISTS envelopes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    createdAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    bank TEXT,
    importBatchId TEXT,
    date TEXT,
    postedDate TEXT,
    merchantRaw TEXT,
    merchantNormalized TEXT,
    amount REAL,
    categoryId TEXT,
    categoryConfidence REAL DEFAULT 0,
    categorySource TEXT DEFAULT 'uncategorized',
    type TEXT DEFAULT 'spend',
    split TEXT,
    notes TEXT,
    hidden INTEGER DEFAULT 0,
    dedupeKey TEXT,
    rawRow TEXT
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT,
    color TEXT,
    archived INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    isIncome INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS merchant_rules (
    merchantNormalized TEXT PRIMARY KEY,
    categoryId TEXT,
    source TEXT,
    hitCount INTEGER DEFAULT 0,
    lastUpdated INTEGER
  );
  CREATE TABLE IF NOT EXISTS budgets (
    categoryId TEXT PRIMARY KEY,
    monthlyLimit REAL
  );
  CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    bank TEXT,
    filename TEXT,
    importedAt INTEGER,
    count INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS outstanding (
    id TEXT PRIMARY KEY,
    transactionId TEXT,
    personName TEXT,
    amount REAL,
    createdAt INTEGER,
    status TEXT DEFAULT 'outstanding',
    settledByTransactionId TEXT,
    settledAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS category_forwards (
    fromCategoryId TEXT PRIMARY KEY,
    toCategoryId TEXT NOT NULL
  );
`);
try { sqldb.exec('ALTER TABLE import_batches ADD COLUMN dateFrom TEXT'); } catch {}
try { sqldb.exec('ALTER TABLE import_batches ADD COLUMN dateTo TEXT'); } catch {}

const TABLES = {
  transactions:     { sql: 'transactions',   pk: 'id' },
  categories:       { sql: 'categories',     pk: 'id' },
  'merchant-rules': { sql: 'merchant_rules', pk: 'merchantNormalized' },
  budgets:          { sql: 'budgets',        pk: 'categoryId' },
  'import-batches': { sql: 'import_batches', pk: 'id' },
  outstanding:      { sql: 'outstanding',    pk: 'id' },
  settings:            { sql: 'settings',          pk: 'key' },
  contacts:            { sql: 'contacts',           pk: 'id' },
  people:              { sql: 'people',             pk: 'id' },
  'category-forwards': { sql: 'category_forwards',  pk: 'fromCategoryId' },
  envelopes:           { sql: 'envelopes',           pk: 'id' },
  'custom-rules':      { sql: 'custom_rules',        pk: 'id' },
  holdings:            { sql: 'holdings',            pk: 'id' },
};

const QUOTED_COLS = new Set(['order']);
const qc = (col) => QUOTED_COLS.has(col) ? `"${col}"` : col;

function toSql(table, col, val) {
  if (val == null) return null;
  if (table === 'transactions') {
    if (col === 'split' || col === 'rawRow')
      return typeof val === 'object' ? JSON.stringify(val) : val;
    if (col === 'hidden' || col === 'holdingLogged') return val ? 1 : 0;
  }
  if (table === 'categories') {
    if (col === 'archived' || col === 'isIncome') return val ? 1 : 0;
  }
  if (table === 'settings' && col === 'value')
    return typeof val === 'string' ? val : JSON.stringify(val);
  return val;
}

function fromSql(table, row) {
  if (!row) return undefined;
  switch (table) {
    case 'transactions':
      return {
        ...row,
        split: row.split ? JSON.parse(row.split) : undefined,
        rawRow: row.rawRow ? JSON.parse(row.rawRow) : undefined,
        hidden: row.hidden === 1,
        holdingLogged: row.holdingLogged === 1,
        amount: Number(row.amount),
        categoryConfidence: Number(row.categoryConfidence || 0),
        spreadMonths: row.spreadMonths != null ? Number(row.spreadMonths) : undefined,
      };
    case 'categories':
      return { ...row, archived: row.archived === 1, isIncome: row.isIncome === 1, order: Number(row.order) };
    case 'merchant_rules':
      return { ...row, hitCount: Number(row.hitCount || 0), lastUpdated: row.lastUpdated != null ? Number(row.lastUpdated) : undefined };
    case 'budgets':
      return { ...row, monthlyLimit: Number(row.monthlyLimit) };
    case 'import_batches':
      return { ...row, importedAt: Number(row.importedAt), count: Number(row.count) };
    case 'outstanding':
      return {
        ...row,
        amount: Number(row.amount),
        createdAt: Number(row.createdAt),
        settledAt: row.settledAt != null ? Number(row.settledAt) : undefined,
        settledByTransactionId: row.settledByTransactionId || undefined,
      };
    case 'settings':
      try { return { key: row.key, value: JSON.parse(row.value) }; }
      catch { return { key: row.key, value: row.value }; }
    default:
      return row;
  }
}

function serializeRow(table, obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = toSql(table, k, v) ?? null;
  return out;
}

// Build INSERT with positional ? placeholders
function buildInsert(sqlTable, cols, orReplace = false) {
  const colStr = cols.map(qc).join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  return `INSERT${orReplace ? ' OR REPLACE' : ''} INTO ${sqlTable} (${colStr}) VALUES (${placeholders})`;
}

function withTx(fn) {
  sqldb.exec('BEGIN');
  try { fn(); sqldb.exec('COMMIT'); }
  catch (e) { sqldb.exec('ROLLBACK'); throw e; }
}

// Bulk insert/upsert helper — normalises all items to the same column set
function bulkInsert(sql, items, orReplace) {
  if (!items.length) return;
  // Collect union of all keys so items with optional fields all fit the same statement
  const allKeys = [...new Set(items.flatMap(i => Object.keys(serializeRow(sql, i))))];
  const stmt = sqldb.prepare(buildInsert(sql, allKeys, orReplace));
  withTx(() => {
    for (const item of items) {
      const data = serializeRow(sql, item);
      // Map each column to its value (null for missing optional fields)
      stmt.run({}, ...allKeys.map(k => (k in data ? data[k] : null)));
    }
  });
}

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

for (const [route, { sql, pk }] of Object.entries(TABLES)) {
  app.get(`/api/${route}`, (_req, res) => {
    res.json(sqldb.prepare(`SELECT * FROM ${sql}`).all().map(r => fromSql(sql, r)));
  });

  app.get(`/api/${route}/count`, (_req, res) => {
    res.json(sqldb.prepare(`SELECT COUNT(*) as n FROM ${sql}`).get().n);
  });

  app.post(`/api/${route}/bulk-add`, (req, res) => {
    const items = req.body;
    if (!items.length) return res.json({ lastId: null });
    bulkInsert(sql, items, false);
    res.json({ lastId: items[items.length - 1][pk] });
  });

  app.post(`/api/${route}/bulk-put`, (req, res) => {
    const items = req.body;
    if (!items.length) return res.json({ ids: [] });
    bulkInsert(sql, items, true);
    res.json({ ids: items.map(i => i[pk]) });
  });

  app.post(`/api/${route}/upsert`, (req, res) => {
    const data = serializeRow(sql, req.body);
    const cols = Object.keys(data);
    const stmt = sqldb.prepare(buildInsert(sql, cols, true));
    stmt.run({}, ...cols.map(k => data[k]));
    res.json({ id: data[pk] });
  });

  // DELETE all (before /:id to avoid route clash)
  app.delete(`/api/${route}`, (_req, res) => {
    sqldb.prepare(`DELETE FROM ${sql}`).run();
    res.json({});
  });

  app.delete(`/api/${route}/where/:field/:value`, (req, res) => {
    const field = decodeURIComponent(req.params.field);
    const value = decodeURIComponent(req.params.value);
    sqldb.prepare(`DELETE FROM ${sql} WHERE ${qc(field)} = ?`).run({}, value);
    res.json({});
  });

  app.get(`/api/${route}/:id`, (req, res) => {
    const row = sqldb.prepare(`SELECT * FROM ${sql} WHERE ${qc(pk)} = ?`).get({}, decodeURIComponent(req.params.id));
    if (!row) return res.status(404).json(null);
    res.json(fromSql(sql, row));
  });

  app.post(`/api/${route}`, (req, res) => {
    const data = serializeRow(sql, req.body);
    const cols = Object.keys(data);
    sqldb.prepare(buildInsert(sql, cols)).run({}, ...cols.map(k => data[k]));
    res.json({ id: data[pk] });
  });

  app.patch(`/api/${route}/:id`, (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const patch = {};
    for (const [k, v] of Object.entries(req.body)) patch[k] = toSql(sql, k, v) ?? null;
    const cols = Object.keys(patch);
    const sets = cols.map(k => `${qc(k)} = ?`).join(', ');
    const r = sqldb.prepare(`UPDATE ${sql} SET ${sets} WHERE ${qc(pk)} = ?`).run({}, ...cols.map(k => patch[k]), id);
    res.json({ updated: r.changes });
  });

  app.delete(`/api/${route}/:id`, (req, res) => {
    sqldb.prepare(`DELETE FROM ${sql} WHERE ${qc(pk)} = ?`).run({}, decodeURIComponent(req.params.id));
    res.json({});
  });
}

app.get('/api/prices', async (req, res) => {
  const tickers = String(req.query.tickers || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!tickers.length) return res.json({ prices: {}, usdcad: null, converted: [] });

  const rawPrices = {};
  const currencies = {};
  await Promise.all([...tickers, 'USDCAD=X'].map(async ticker => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      rawPrices[ticker] = meta?.regularMarketPrice ?? null;
      currencies[ticker] = meta?.currency ?? null;
    } catch { rawPrices[ticker] = null; currencies[ticker] = null; }
  }));

  const usdcad = rawPrices['USDCAD=X'] ?? null;
  const prices = {};
  const converted = [];
  for (const ticker of tickers) {
    const price = rawPrices[ticker];
    if (price != null && currencies[ticker] === 'USD' && usdcad != null) {
      prices[ticker] = price * usdcad;
      converted.push(ticker);
    } else {
      prices[ticker] = price;
    }
  }
  res.json({ prices, usdcad, converted });
});

app.get('/api/ticker-search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=0&listsCount=0`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();
    const quotes = (data?.quotes ?? []).filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF');
    res.json(quotes.slice(0, 8).map(q => ({ ticker: q.symbol, name: q.shortname || q.longname || '' })));
  } catch { res.json([]); }
});

app.delete('/api/all', (_req, res) => {
  sqldb.exec(Object.values(TABLES).map(({ sql }) => `DELETE FROM ${sql};`).join(''));
  res.json({});
});

// Serve built frontend when running inside Electron
if (process.versions.electron) {
  const DIST_DIR = join(__dirname, 'dist');
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')));
}

// Global error handler — log to console and echo message to browser
app.use((err, _req, res, _next) => {
  console.error('[API error]', err.message, err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(3001, '127.0.0.1', () => {
  process.stdout.write('Budget API → http://localhost:3001\n');
});
