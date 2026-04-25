import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Category } from '../types';
import { bulkRecategorizeByCategory } from '../lib/recategorize';
import { exportAll, importAll, wipeAll } from '../lib/backup';

export function SettingsPage() {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const batches = useLiveQuery(() => db.importBatches.orderBy('importedAt').reverse().toArray(), []) ?? [];
  const [editing, setEditing] = useState<Category | null>(null);
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^\w]+/g, '-').slice(0, 40);
    if (await db.categories.get(id)) {
      alert('A category with that id already exists.');
      return;
    }
    const maxOrder = Math.max(...categories.map((c) => c.order), 0);
    await db.categories.add({ id, name, color: randomColor(), order: maxOrder + 10 });
    setNewName('');
  }

  async function saveEdit(c: Category) {
    await db.categories.put(c);
    setEditing(null);
  }

  async function archive(c: Category) {
    if (!window.confirm(`Archive "${c.name}"? Transactions keep the category but it won't appear in new dropdowns.`)) return;
    await db.categories.update(c.id, { archived: !c.archived });
  }

  async function deleteCategory(c: Category) {
    const count = await db.transactions.where('categoryId').equals(c.id).count();
    if (count > 0) {
      if (!window.confirm(`"${c.name}" is used by ${count} transactions. They will be re-set to Uncategorized. Proceed?`)) return;
      await bulkRecategorizeByCategory(c.id, null);
    }
    await db.categories.delete(c.id);
    await db.merchantRules.where('categoryId').equals(c.id).delete();
    await db.budgets.delete(c.id);
  }

  async function downloadBackup() {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(file: File) {
    if (!window.confirm('Restoring will replace all current data. Continue?')) return;
    try {
      const text = await file.text();
      await importAll(text);
      setStatus('Restore complete.');
    } catch (e) {
      setStatus(`Restore failed: ${(e as Error).message}`);
    }
  }

  async function wipe() {
    if (!window.confirm('Delete ALL local data? This cannot be undone.')) return;
    if (!window.confirm('Really sure? All transactions, categories, budgets, history — everything — will be gone.')) return;
    await wipeAll();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <div className="font-medium">Categories</div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="New category name"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button onClick={addCategory} className="px-3 py-1 rounded bg-sky-600 text-white text-sm hover:bg-sky-700">Add</button>
        </div>
        <div className="space-y-1">
          {categories.map((c) => (
            <div key={c.id} className={`flex items-center gap-2 text-sm py-1 ${c.archived ? 'opacity-50' : ''}`}>
              {editing?.id === c.id ? (
                <>
                  <input
                    type="color"
                    value={editing.color}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                    className="w-8 h-7 border-0 p-0"
                  />
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-0.5 text-sm flex-1"
                  />
                  <button onClick={() => saveEdit(editing)} className="text-xs text-emerald-700 hover:text-emerald-900">Save</button>
                  <button onClick={() => setEditing(null)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                </>
              ) : (
                <>
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: c.color }} />
                  <span className="flex-1">{c.name}{c.isIncome && <span className="ml-2 text-xs text-slate-400">(income)</span>}{c.archived && <span className="ml-2 text-xs text-slate-400">(archived)</span>}</span>
                  <button onClick={() => setEditing(c)} className="text-xs text-slate-500 hover:text-slate-700">Edit</button>
                  <button onClick={() => archive(c)} className="text-xs text-slate-500 hover:text-slate-700">{c.archived ? 'Unarchive' : 'Archive'}</button>
                  <button onClick={() => deleteCategory(c)} className="text-xs text-rose-500 hover:text-rose-700">Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4 space-y-2">
        <div className="font-medium">Import history</div>
        {batches.length === 0 ? (
          <div className="text-sm text-slate-500">No imports yet.</div>
        ) : (
          <ul className="text-sm space-y-1">
            {batches.map((b) => (
              <li key={b.id} className="flex justify-between">
                <span>
                  <span className="uppercase text-xs text-slate-500 mr-2">{b.bank}</span>
                  {b.filename}
                </span>
                <span className="text-slate-500">
                  {new Date(b.importedAt).toLocaleString()} — {b.count} rows
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete all ${b.count} transactions from this import?`)) return;
                      await db.transactions.where('importBatchId').equals(b.id).delete();
                      await db.importBatches.delete(b.id);
                    }}
                    className="ml-3 text-rose-600 hover:text-rose-800 text-xs"
                  >
                    Undo import
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <div className="font-medium">Backup</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={downloadBackup} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">Download JSON backup</button>
          <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">Restore from backup…</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restoreBackup(f);
              if (fileRef.current) fileRef.current.value = '';
            }}
          />
          <button onClick={wipe} className="px-3 py-1.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 ml-auto">
            Wipe all local data
          </button>
        </div>
        {status && <div className="text-sm text-slate-600">{status}</div>}
        <div className="text-xs text-slate-500">All data lives in your browser (IndexedDB). Nothing is sent anywhere.</div>
      </section>
    </div>
  );
}

function randomColor(): string {
  const palette = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#84cc16', '#f97316'];
  return palette[Math.floor(Math.random() * palette.length)];
}
