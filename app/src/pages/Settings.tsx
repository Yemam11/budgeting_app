import { useMemo, useRef, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import type { Category, MerchantRule } from '../types';
import { bulkRecategorizeByCategory } from '../lib/recategorize';
import { exportAll, importAll, wipeAll } from '../lib/backup';
import { Icon, CatSwatch, Toggle } from '../components/Primitives';

function randomColor(): string {
  const hues = [200, 165, 50, 10, 270, 320, 100, 30];
  const h = hues[Math.floor(Math.random() * hues.length)];
  return `oklch(60% 0.18 ${h})`;
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage({ userName = '' }: { userName?: string }) {
  const categories = useQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const merchantRules = useQuery(() => db.merchantRules.toArray(), []) ?? [];
  const txCount = useQuery(() => db.transactions.count(), []) ?? 0;

  const rawThreshold = useQuery(() => db.settings.get('confidenceThreshold'), []);
  const confidenceThreshold = rawThreshold ? Number(rawThreshold.value) : 0.85;

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const [editing, setEditing] = useState<Category | null>(null);
  const [newName, setNewName] = useState('');
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<{ rule: MerchantRule; newCatId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  function startEditName() { setNameInput(userName); setEditingName(true); }
  async function saveName() {
    await db.settings.put({ key: 'userName', value: nameInput.trim() });
    setEditingName(false);
  }

  function onEditRule(rule: MerchantRule, newCatId: string) {
    if (newCatId === rule.categoryId) return;
    setEditingRule({ rule, newCatId });
  }

  async function applyRuleEdit(applyToPast: boolean) {
    if (!editingRule) return;
    const { rule, newCatId } = editingRule;
    setEditingRule(null);
    await db.merchantRules.put({ ...rule, categoryId: newCatId, lastUpdated: Date.now() });
    if (applyToPast) {
      const txs = await db.transactions.where('merchantNormalized').equals(rule.merchantNormalized).toArray();
      for (const tx of txs) {
        if (tx.categorySource === 'user') continue;
        await db.transactions.update(tx.id, { categoryId: newCatId, categoryConfidence: 1, categorySource: 'merchant-rule' });
      }
      const n = txs.filter(t => t.categorySource !== 'user').length;
      setStatus(`Updated rule and ${n} past transaction${n === 1 ? '' : 's'}.`);
      setTimeout(() => setStatus(null), 4000);
    }
  }

  async function onDeleteRule(rule: MerchantRule) {
    if (!window.confirm(`Delete the rule for "${rule.merchantNormalized}"? Future imports won't be auto-categorized — existing transactions are unchanged.`)) return;
    await db.merchantRules.delete(rule.merchantNormalized);
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^\w]+/g, '-').slice(0, 40);
    if (await db.categories.get(id)) { alert('A category with that id already exists.'); return; }
    const maxOrder = Math.max(...categories.map(c => c.order), 0);
    await db.categories.add({ id, name, color: randomColor(), order: maxOrder + 10 });
    setNewName('');
    setNewCatOpen(false);
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
      await importAll(await file.text());
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

  const activeCategories = categories.filter(c => !c.archived);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      {/* Header */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Preferences</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Settings</div>
      </div>

      {/* Profile */}
      <Section title="Profile" desc="How the app addresses you.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {editingName ? (
            <>
              <input
                className="input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                placeholder="Your name"
                style={{ flex: 1, fontSize: 13 }}
                autoFocus
              />
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveName}>Save</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditingName(false)}>Cancel</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{userName || <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>Not set</span>}</div>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={startEditName}>
                <Icon name="settings" size={12} />{userName ? 'Edit' : 'Set name'}
              </button>
            </>
          )}
        </div>
      </Section>

      {/* Categorization */}
      <Section title="Categorization" desc="Control how transactions are auto-categorized on import.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Confidence threshold */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Confidence threshold for auto-categorization</div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--accent-ink)', fontWeight: 500 }}>
                {Math.round(confidenceThreshold * 100)}%
              </div>
            </div>
            <input
              type="range"
              min={50} max={100} step={5}
              value={Math.round(confidenceThreshold * 100)}
              onChange={e => db.settings.put({ key: 'confidenceThreshold', value: String(Number(e.target.value) / 100) })}
              style={{ width: '100%', accentColor: 'var(--accent)', height: 6, cursor: 'pointer' }}
            />
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}>
              Transactions below this confidence are flagged for review.
            </div>
          </div>

          {/* Propagate toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Propagate category changes to past merchants</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                When you re-categorize, update other transactions from the same merchant.
              </div>
            </div>
            <Toggle on={true} />
          </div>

          {/* Exclude owed toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Exclude "owed" amounts from spending totals</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
                Split transactions only count your share.
              </div>
            </div>
            <Toggle on={true} />
          </div>
        </div>
      </Section>

      {/* Data & privacy */}
      <Section title="Data & privacy" desc="Your data stays on this device.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'color-mix(in oklab, var(--accent-soft), white 60%)', borderRadius: 10, border: '1px solid color-mix(in oklab, var(--accent), transparent 70%)' }}>
            <Icon name="lock" size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Local-only mode</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                Stored in browser (IndexedDB) · {txCount} txns · never uploaded
              </div>
            </div>
            <span className="chip chip-accent">Active</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={downloadBackup}>
              <Icon name="download" size={13} />Export backup (.json)
            </button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={13} />Restore backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) restoreBackup(f);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
            <div style={{ flex: 1 }} />
            <button
              className="btn"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
              onClick={wipe}
            >
              Clear all data
            </button>
          </div>
          {status && (
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '4px 0' }}>{status}</div>
          )}
        </div>
      </Section>

      {/* Categories */}
      <Section title="Categories" desc={`${activeCategories.length} active · manage colors, names, and archive.`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map(c => (
            editing?.id === c.id ? (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 20, border: '1px solid var(--accent)', background: 'var(--accent-soft)' }}>
                <input
                  type="color"
                  value={editing.color.startsWith('oklch') ? '#14b8a6' : editing.color}
                  onChange={e => setEditing({ ...editing, color: e.target.value })}
                  style={{ width: 18, height: 18, border: 'none', borderRadius: '50%', padding: 0, cursor: 'pointer' }}
                />
                <input
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(editing); if (e.key === 'Escape') setEditing(null); }}
                  style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 500, outline: 'none', width: 90 }}
                  autoFocus
                />
                <button onClick={() => saveEdit(editing)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-ink)', fontSize: 11, padding: 0 }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', fontSize: 11, padding: 0 }}>✕</button>
              </div>
            ) : (
              <div
                key={c.id}
                className="chip"
                style={{
                  background: `color-mix(in oklab, ${c.color}, transparent 86%)`,
                  borderColor: `color-mix(in oklab, ${c.color}, transparent 70%)`,
                  color: `color-mix(in oklab, ${c.color}, black 20%)`,
                  opacity: c.archived ? 0.4 : 1,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
                onClick={() => setEditing(c)}
                title={c.archived ? 'Archived' : 'Click to edit'}
              >
                <CatSwatch color={c.color} size={6} />
                {c.name}
                {c.archived && <span style={{ fontSize: 9, opacity: 0.7 }}> archived</span>}
              </div>
            )
          ))}

          {newCatOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px dashed var(--accent)', background: 'var(--accent-soft)' }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setNewCatOpen(false); setNewName(''); } }}
                placeholder="Category name"
                style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', width: 110 }}
                autoFocus
              />
              <button onClick={addCategory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-ink)', fontSize: 11, padding: 0 }}>Add</button>
              <button onClick={() => { setNewCatOpen(false); setNewName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', fontSize: 11, padding: 0 }}>✕</button>
            </div>
          ) : (
            <button
              className="chip"
              style={{ background: 'transparent', borderStyle: 'dashed', cursor: 'pointer' }}
              onClick={() => setNewCatOpen(true)}
            >
              <Icon name="plus" size={10} />New category
            </button>
          )}
        </div>

        {/* Archive/delete actions for editing category */}
        {editing && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => archive(editing)}>
              {editing.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              className="btn"
              style={{ fontSize: 11, background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
              onClick={() => { deleteCategory(editing); setEditing(null); }}
            >
              Delete
            </button>
          </div>
        )}
      </Section>

      {/* Merchant Rules */}
      <Section title="Merchant rules" desc={`${merchantRules.length} rule${merchantRules.length === 1 ? '' : 's'} · applied automatically on import.`}>
        {merchantRules.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>
            No rules yet. When you categorize a merchant and choose "All transactions from this merchant", a rule is saved here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...merchantRules].sort((a, b) => a.merchantNormalized.localeCompare(b.merchantNormalized)).map((rule, idx) => {
              const cat = catMap.get(rule.categoryId);
              return (
                <div key={rule.merchantNormalized} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < merchantRules.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ flex: 1, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rule.merchantNormalized}>
                    {rule.merchantNormalized}
                  </div>
                  {cat && <CatSwatch color={cat.color} size={8} />}
                  <select
                    value={rule.categoryId}
                    onChange={e => onEditRule(rule, e.target.value)}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '3px 8px', appearance: 'none', cursor: 'pointer' }}
                  >
                    {categories.filter(c => !c.archived).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onDeleteRule(rule)}
                    title="Delete rule"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Rule edit scope dialog */}
      {editingRule && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditingRule(null)}
        >
          <div className="glass" style={{ padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Update merchant rule</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 20 }}>
              <em>"{editingRule.rule.merchantNormalized}"</em> → <strong style={{ color: 'var(--ink)' }}>{catMap.get(editingRule.newCatId)?.name ?? editingRule.newCatId}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                autoFocus
                onClick={() => applyRuleEdit(true)}
              >
                <Icon name="check" size={14} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div>Apply to all past transactions</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 1 }}>Re-categorizes existing transactions from this merchant</div>
                </div>
              </button>
              <button
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                onClick={() => applyRuleEdit(false)}
              >
                <Icon name="import" size={14} />
                <div style={{ textAlign: 'left' }}>Just new imports</div>
              </button>
              <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={() => setEditingRule(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
