import { useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import type { AmountOp, Category, CustomRule, MerchantRule, Person, TxType } from '../types';
import { applyCustomRules } from '../lib/customRules';
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

const TYPE_OPTS: { value: TxType; label: string }[] = [
  { value: 'spend',      label: 'Spend' },
  { value: 'income',     label: 'Income' },
  { value: 'savings',    label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'transfer',   label: 'Transfer' },
  { value: 'cc-payment', label: 'CC Payment' },
];

const AMOUNT_OPS: { value: AmountOp; label: string }[] = [
  { value: '>',  label: '>' },
  { value: '>=', label: '>=' },
  { value: '<',  label: '<' },
  { value: '<=', label: '<=' },
  { value: '=',  label: '=' },
];

export function SettingsPage({ userName = '' }: { userName?: string }) {
  const categories = useQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const merchantRules = useQuery(() => db.merchantRules.toArray(), []) ?? [];
  const customRules = useQuery(() => db.customRules.orderBy('priority').toArray(), []) ?? [];
  const people = useQuery(() => db.people.orderBy('createdAt').toArray(), []) ?? [];
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

  // People management
  const [newPersonName, setNewPersonName] = useState('');

  // Category delete reclassify dialog
  const [deletePending, setDeletePending] = useState<Category | null>(null);
  const [deletePendingCount, setDeletePendingCount] = useState(0);
  const [reclassifyTargetId, setReclassifyTargetId] = useState('');

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
    setEditing(null);
    const count = await db.transactions.where('categoryId').equals(c.id).count();
    setDeletePendingCount(count);
    setReclassifyTargetId('');
    setDeletePending(c);
  }

  async function confirmDeleteCategory() {
    if (!deletePending) return;
    const c = deletePending;
    setDeletePending(null);
    const targetId = reclassifyTargetId || null;

    await bulkRecategorizeByCategory(c.id, targetId);

    if (targetId) {
      // Redirect merchant rules that pointed to the deleted category
      const affected = merchantRules.filter(r => r.categoryId === c.id);
      for (const rule of affected) {
        await db.merchantRules.put({ ...rule, categoryId: targetId, lastUpdated: Date.now() });
      }
      // Save the permanent forward rule for future imports
      await db.categoryForwards.put({ fromCategoryId: c.id, toCategoryId: targetId });
    } else {
      await db.merchantRules.where('categoryId').equals(c.id).delete();
    }

    await db.categories.delete(c.id);
    await db.budgets.delete(c.id);
  }

  async function addPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      setStatus('A person with that name already exists.'); setTimeout(() => setStatus(null), 3000); return;
    }
    await db.people.add({ id: nanoid(), name, createdAt: Date.now() });
    setNewPersonName('');
  }

  async function deletePerson(p: Person) {
    if (!window.confirm(`Remove "${p.name}"? Transactions tagged to them will keep the tag.`)) return;
    await db.people.delete(p.id);
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

  // ── Custom rules state ───────────────────────────────────────────
  const [crFormOpen, setCrFormOpen] = useState(false);
  const [crEditId,   setCrEditId]   = useState<string | null>(null);
  const [crName,          setCrName]          = useState('');
  const [crMerchant,      setCrMerchant]      = useState('');
  const [crAmountOp,      setCrAmountOp]      = useState<AmountOp>('>');
  const [crAmountValue,   setCrAmountValue]   = useState('');
  const [crUseAmount,     setCrUseAmount]     = useState(false);
  const [crTargetType,    setCrTargetType]    = useState<TxType | ''>('');
  const [crTargetCat,     setCrTargetCat]     = useState('');

  function resetCrForm() {
    setCrEditId(null); setCrName(''); setCrMerchant(''); setCrAmountOp('>');
    setCrAmountValue(''); setCrUseAmount(false); setCrTargetType(''); setCrTargetCat('');
    setCrFormOpen(false);
  }

  function openEditCr(r: CustomRule) {
    setCrEditId(r.id); setCrName(r.name); setCrMerchant(r.merchantContains ?? '');
    setCrUseAmount(r.amountOp !== undefined); setCrAmountOp(r.amountOp ?? '>');
    setCrAmountValue(r.amountValue !== undefined ? String(r.amountValue) : '');
    setCrTargetType(r.targetType ?? ''); setCrTargetCat(r.targetCategoryId ?? '');
    setCrFormOpen(true);
  }

  async function saveCrRule(applyToPast: boolean) {
    if (!crMerchant.trim() && !crUseAmount) return;
    if (!crTargetType && !crTargetCat) return;
    const id = crEditId ?? nanoid();
    const amtVal = parseFloat(crAmountValue);
    const rule: CustomRule = {
      id,
      name: crName.trim() || crMerchant.trim(),
      merchantContains: crMerchant.trim() || undefined,
      amountOp: crUseAmount ? crAmountOp : undefined,
      amountValue: crUseAmount && !isNaN(amtVal) ? amtVal : undefined,
      targetType: crTargetType || undefined,
      targetCategoryId: crTargetCat || undefined,
      priority: crEditId ? (customRules.find(r => r.id === crEditId)?.priority ?? customRules.length) : customRules.length,
      createdAt: crEditId ? (customRules.find(r => r.id === crEditId)?.createdAt ?? Date.now()) : Date.now(),
    };
    await db.customRules.put(rule);
    if (applyToPast) {
      const txs = await db.transactions.toArray();
      let n = 0;
      for (const tx of txs) {
        const patch = applyCustomRules([rule], tx);
        if (patch) { await db.transactions.update(tx.id, patch); n++; }
      }
      setStatus(`Rule saved · applied to ${n} past transaction${n === 1 ? '' : 's'}.`);
      setTimeout(() => setStatus(null), 4000);
    }
    resetCrForm();
  }

  async function deleteCrRule(id: string) {
    if (!window.confirm('Delete this rule? Future imports won\'t be affected by it.')) return;
    await db.customRules.delete(id);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--accent-soft)', borderRadius: 10, border: '1px solid color-mix(in oklab, var(--accent), transparent 70%)' }}>
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

      {/* People */}
      <Section title="People" desc="Custom names you can tag to transactions to track who they're for.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {people.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 10 }}>
              No people added yet. Add a name below to start tagging transactions.
            </div>
          )}
          {people.map((p, idx) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: idx < people.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <button
                onClick={() => deletePerson(p)}
                title="Remove"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: people.length ? 10 : 0 }}>
            <input
              className="input"
              placeholder="Add person…"
              value={newPersonName}
              onChange={e => setNewPersonName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addPerson(); }}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button className="btn btn-ghost" onClick={addPerson} disabled={!newPersonName.trim()}>
              <Icon name="plus" size={12} />Add
            </button>
          </div>
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

      {/* Custom Rules */}
      <Section
        title="Custom rules"
        desc="IF-THEN rules applied on import. Each rule can match by merchant keyword and/or amount, then set the transaction type or category."
      >
        {customRules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
            {customRules.map((rule, idx) => (
              <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: idx < customRules.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {rule.merchantContains && (
                      <span className="chip">merchant contains <strong style={{ color: 'var(--ink-soft)' }}>"{rule.merchantContains}"</strong></span>
                    )}
                    {rule.amountOp && rule.amountValue !== undefined && (
                      <span className="chip">amount {rule.amountOp} <strong style={{ color: 'var(--ink-soft)' }}>${rule.amountValue}</strong></span>
                    )}
                    <span style={{ color: 'var(--ink-mute)', alignSelf: 'center' }}>→</span>
                    {rule.targetType && (
                      <span className="chip chip-accent">type: {rule.targetType}</span>
                    )}
                    {rule.targetCategoryId && (
                      <span className="chip chip-accent">category: {catMap.get(rule.targetCategoryId)?.name ?? rule.targetCategoryId}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => openEditCr(rule)} className="btn btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}>
                  Edit
                </button>
                <button onClick={() => deleteCrRule(rule.id)} title="Delete"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: '2px 4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {crFormOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 12, background: 'var(--card-surface)', border: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{crEditId ? 'Edit rule' : 'New rule'}</div>

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rule name (optional)</label>
              <input className="input" value={crName} onChange={e => setCrName(e.target.value)} placeholder="e.g. Auto-savings" style={{ fontSize: 13 }} />
            </div>

            {/* IF block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent), transparent 72%)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>IF (all must match)</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Merchant / description contains</label>
                <input className="input" value={crMerchant} onChange={e => setCrMerchant(e.target.value)}
                  placeholder="e.g. Investment Purchase" style={{ fontSize: 13 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="cr-use-amount" checked={crUseAmount} onChange={e => setCrUseAmount(e.target.checked)} />
                <label htmlFor="cr-use-amount" style={{ fontSize: 12, color: 'var(--ink-soft)', cursor: 'pointer' }}>Also match by amount</label>
              </div>
              {crUseAmount && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="btn btn-ghost" value={crAmountOp} onChange={e => setCrAmountOp(e.target.value as AmountOp)} style={{ fontSize: 12, padding: '4px 8px' }}>
                    {AMOUNT_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input className="input" value={crAmountValue} onChange={e => setCrAmountValue(e.target.value)}
                    placeholder="100" type="number" min="0" step="0.01" style={{ width: 110, fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>(absolute value, ignores sign)</span>
                </div>
              )}
            </div>

            {/* THEN block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 10, background: 'var(--card-surface-2)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>THEN</div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
                  <label style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Set type to</label>
                  <select className="btn btn-ghost" value={crTargetType} onChange={e => setCrTargetType(e.target.value as TxType | '')} style={{ fontSize: 12, appearance: 'none' }}>
                    <option value="">(no change)</option>
                    {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
                  <label style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Set category to</label>
                  <select className="btn btn-ghost" value={crTargetCat} onChange={e => setCrTargetCat(e.target.value)} style={{ fontSize: 12, appearance: 'none' }}>
                    <option value="">(no change)</option>
                    {categories.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ fontSize: 12 }}
                disabled={(!crMerchant.trim() && !crUseAmount) || (!crTargetType && !crTargetCat)}
                onClick={() => saveCrRule(false)}>
                Save rule
              </button>
              <button className="btn" style={{ fontSize: 12, background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: 'color-mix(in oklab, var(--accent), transparent 60%)' }}
                disabled={(!crMerchant.trim() && !crUseAmount) || (!crTargetType && !crTargetCat)}
                onClick={() => saveCrRule(true)}>
                Save &amp; apply to past transactions
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={resetCrForm}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { resetCrForm(); setCrFormOpen(true); }}>
            <Icon name="plus" size={12} />New rule
          </button>
        )}
      </Section>

      {/* Category delete + reclassify dialog */}
      {deletePending && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDeletePending(null)}
        >
          <div className="glass" style={{ padding: 24, maxWidth: 420, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Delete "{deletePending.name}"</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 20 }}>
              {deletePendingCount > 0
                ? <><strong style={{ color: 'var(--ink)' }}>{deletePendingCount} transaction{deletePendingCount === 1 ? '' : 's'}</strong> will be reclassified. Choose a category to move them to, or leave blank to set them as Uncategorized.</>
                : <>No transactions use this category. It will be deleted.</>}
              <div style={{ marginTop: 12, fontSize: 12, color: 'oklch(55% 0.14 75)' }}>
                Merchant rules and future imports will also be redirected to the chosen category.
              </div>
            </div>
            {deletePendingCount > 0 && (
              <div style={{ marginBottom: 20 }}>
                <select
                  value={reclassifyTargetId}
                  onChange={e => setReclassifyTargetId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--native-select-bg)', fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--sans)' }}
                >
                  <option value="">Uncategorized</option>
                  {categories.filter(c => !c.archived && c.id !== deletePending.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeletePending(null)}>Cancel</button>
              <button
                className="btn"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
                onClick={confirmDeleteCategory}
              >
                <Icon name="trash" size={13} />Delete{reclassifyTargetId ? ` & reclassify to ${catMap.get(reclassifyTargetId)?.name}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

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
