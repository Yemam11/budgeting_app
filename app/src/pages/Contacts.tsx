import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD } from '../lib/money';
import { Icon } from '../components/Primitives';
import type { OutstandingEntry } from '../types';
import { manuallySettle } from '../lib/outstanding';

export function ContactsPage() {
  const entries = useQuery(() => db.outstanding.toArray(), []) ?? [];
  const txs = useQuery(() => db.transactions.toArray(), []) ?? [];
  const contacts = useQuery(() => db.contacts.toArray(), []) ?? [];

  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBusy, setNewBusy] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const txMap = useMemo(() => new Map(txs.map(t => [t.id, t])), [txs]);

  // Union of: contacts table + anyone who appears in outstanding entries
  const allNames = useMemo(() => {
    const s = new Set<string>(contacts.map(c => c.name));
    for (const e of entries) s.add(e.personName);
    return s;
  }, [contacts, entries]);

  const byPerson = useMemo(() => {
    return Array.from(allNames).map(name => {
      const personEntries = entries.filter(e => e.personName === name);
      const outstanding = personEntries.filter(e => e.status !== 'settled');
      const settled = personEntries.filter(e => e.status === 'settled');
      const totalOutstanding = outstanding.reduce((s, e) => s + e.amount, 0);
      const totalSettled = settled.reduce((s, e) => s + e.amount, 0);
      const inContactsTable = contacts.some(c => c.name === name);
      return { name, personEntries, outstanding, settled, totalOutstanding, totalSettled, inContactsTable };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding || a.name.localeCompare(b.name));
  }, [allNames, entries, contacts]);

  const avatarColor = (name: string) => `oklch(68% 0.1 ${(name.charCodeAt(0) * 47 + 120) % 360})`;

  async function createContact() {
    const name = newName.trim();
    if (!name) return;
    setNewBusy(true);
    const exists = contacts.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (!exists) await db.contacts.add({ id: nanoid(), name, createdAt: Date.now() });
    setNewName('');
    setNewContactOpen(false);
    setNewBusy(false);
  }

  async function deleteContact(name: string) {
    if (!window.confirm(`Remove "${name}" from contacts? Their transaction history will remain.`)) return;
    const contact = contacts.find(c => c.name === name);
    if (contact) await db.contacts.delete(contact.id);
  }

  function startEdit(name: string) {
    setEditingName(name);
    setEditDraft(name);
  }

  async function saveEdit(oldName: string) {
    const newName = editDraft.trim();
    setEditingName(null);
    if (!newName || newName === oldName) return;
    const contact = contacts.find(c => c.name === oldName);
    if (contact) await db.contacts.update(contact.id, { name: newName } as Partial<typeof contact>);
    for (const e of entries.filter(e => e.personName === oldName)) {
      await db.outstanding.update(e.id, { personName: newName } as Partial<typeof e>);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>People</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Contacts</div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 4 }}>
            {byPerson.length} {byPerson.length === 1 ? 'contact' : 'contacts'}
            {entries.filter(e => e.status !== 'settled').length > 0 && ` · ${fmtCAD(byPerson.reduce((s, p) => s + p.totalOutstanding, 0))} outstanding`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setNewContactOpen(true)}>
          <Icon name="plus" size={14} />New contact
        </button>
      </div>

      {byPerson.length === 0 && (
        <div className="glass" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-mute)' }}>
          <Icon name="owed" size={28} />
          <div style={{ marginTop: 12, fontWeight: 500, fontSize: 14 }}>No contacts yet</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Create a contact or mark transactions as "Owed" to get started.</div>
        </div>
      )}

      {byPerson.map(({ name, outstanding, settled, totalOutstanding, totalSettled, inContactsTable }) => (
        <div key={name} className="glass" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Person header */}
          <div style={{ padding: '18px 20px', borderBottom: outstanding.length + settled.length > 0 ? '1px solid var(--line)' : undefined, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: avatarColor(name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 17, fontWeight: 600,
              boxShadow: `0 0 0 3px color-mix(in oklab, ${avatarColor(name)}, transparent 75%)`,
            }}>
              {name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingName === name ? (
                <input
                  className="input"
                  style={{ fontSize: 15, fontWeight: 600, padding: '3px 8px', marginBottom: 2 }}
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => saveEdit(name)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(name);
                    if (e.key === 'Escape') setEditingName(null);
                  }}
                  autoFocus
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
              )}
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                {outstanding.length + settled.length} {outstanding.length + settled.length === 1 ? 'entry' : 'entries'}
                {settled.length > 0 && ` · ${settled.length} settled`}
                {!inContactsTable && <span style={{ marginLeft: 8, color: 'var(--ink-mute)', fontStyle: 'italic' }}>· not saved as contact</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {totalOutstanding > 0 ? (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Owes you</div>
                    <div className="mono" style={{ fontWeight: 600, fontSize: 20, color: 'oklch(55% 0.14 75)' }}>{fmtCAD(totalOutstanding)}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{settled.length > 0 ? 'All settled' : 'No entries'}</div>
                    {settled.length > 0 && <div className="mono" style={{ fontWeight: 500, fontSize: 16, color: 'var(--accent-ink)' }}>{fmtCAD(totalSettled)}</div>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => startEdit(name)}
                  title="Rename contact"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: 4, borderRadius: 6, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-mute)')}
                >
                  <Icon name="edit" size={14} />
                </button>
                <button
                  onClick={() => deleteContact(name)}
                  title="Remove contact"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: 4, borderRadius: 6, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-mute)')}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Outstanding entries */}
          {outstanding.length > 0 && (
            <div>
              <div style={{ padding: '10px 20px 4px', fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Outstanding
              </div>
              <table className="data">
                <tbody>
                  {outstanding.map(e => {
                    const src = txMap.get(e.transactionId);
                    return (
                      <tr key={e.id}>
                        <td className="mono" style={{ color: 'var(--ink-mute)', fontSize: 12, width: 80 }}>
                          {(src?.date ?? new Date(e.createdAt).toISOString().slice(0, 10)).slice(5)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{src?.merchantRaw ?? '—'}</td>
                        <td>
                          <span className="chip chip-warn" style={{ fontSize: 10 }}>Owes you</span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'oklch(55% 0.14 75)', width: 100 }}>
                          {fmtCAD(e.amount)}
                        </td>
                        <td style={{ width: 160, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}
                              onClick={async () => {
                                if (window.confirm(`Remove owed entry for ${name} (${fmtCAD(e.amount)})?`)) {
                                  await db.outstanding.delete(e.id);
                                }
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => manuallySettle(e.id)}
                            >
                              Mark paid
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Settled (collapsible) */}
          {settled.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', padding: '10px 20px', fontSize: 12, color: 'var(--ink-mute)', userSelect: 'none' }}>
                {settled.length} settled · {fmtCAD(totalSettled)} total
              </summary>
              <table className="data">
                <tbody>
                  {settled.map(e => {
                    const src = txMap.get(e.transactionId);
                    return (
                      <tr key={e.id} style={{ opacity: 0.55 }}>
                        <td className="mono" style={{ color: 'var(--ink-mute)', fontSize: 12, width: 80 }}>
                          {(src?.date ?? '').slice(5)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{src?.merchantRaw ?? '—'}</td>
                        <td>
                          <span className="chip chip-accent" style={{ fontSize: 10 }}>Settled</span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', width: 100 }}>{fmtCAD(e.amount)}</td>
                        <td style={{ width: 160, textAlign: 'right' }}>
                          <button
                            style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                            onClick={() => db.outstanding.delete(e.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          )}
        </div>
      ))}

      {/* New contact modal */}
      {newContactOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,12,18,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNewContactOpen(false)}>
          <div className="glass" style={{ padding: 24, maxWidth: 360, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>New contact</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 18 }}>
              Add someone to your contacts list so they're available when splitting or tracking owed amounts.
            </div>
            <input
              className="input"
              style={{ width: '100%', marginBottom: 16 }}
              placeholder="Contact name (e.g. Mom, Alex)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createContact(); if (e.key === 'Escape') setNewContactOpen(false); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setNewContactOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!newName.trim() || newBusy} onClick={createContact}>
                <Icon name="plus" size={14} />Add contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
