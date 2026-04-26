import { useEffect, useState } from 'react';
import { useQuery } from './hooks/useQuery';
import { ensureSeeded } from './lib/seed';
import { db } from './db';
import { DashboardPage } from './pages/Dashboard';
import { ImportPage } from './pages/Import';
import { TransactionsPage } from './pages/Transactions';
import { BudgetsPage } from './pages/Budgets';
import { OutstandingPage } from './pages/Outstanding';
import { ContactsPage } from './pages/Contacts';
import { SettingsPage } from './pages/Settings';
import { Icon } from './components/Primitives';

type Tab = 'dashboard' | 'import' | 'transactions' | 'budgets' | 'outstanding' | 'contacts' | 'settings';

const NAV: ({ section: string } | { id: Tab; label: string; icon: string })[] = [
  { section: 'General' },
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'transactions', label: 'Transactions', icon: 'transactions' },
  { id: 'budgets', label: 'Budgets', icon: 'budget' },
  { section: 'Tools' },
  { id: 'import', label: 'Import', icon: 'import' },
  { id: 'outstanding', label: 'Owed to you', icon: 'owed' },
  { id: 'contacts', label: 'Contacts', icon: 'bank' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [ready, setReady] = useState(false);

  const outstandingCount = useQuery(
    () => db.outstanding.where('status').notEqual('settled').count(), []
  ) ?? 0;

  useEffect(() => { ensureSeeded().then(() => setReady(true)); }, []);

  if (!ready) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      <aside style={{
        width: 240, flexShrink: 0,
        padding: '20px 14px',
        display: 'flex', flexDirection: 'column', gap: 4,
        borderRight: '1px solid var(--line)',
        background: 'color-mix(in oklab, white 45%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px', borderBottom: '1px solid var(--line)', marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, oklch(22% 0.02 260), oklch(15% 0.02 260))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.15)',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)', transform: 'rotate(45deg)' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>WealthWise</div>
            <div className="eyebrow" style={{ letterSpacing: '0.08em', marginTop: 1 }}>Local · Private</div>
          </div>
        </div>

        {/* Search (decorative) */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>
            <Icon name="search" size={13} />
          </div>
          <input className="input" placeholder="Quick search…" style={{ width: '100%', paddingLeft: 30, fontSize: 12 }} readOnly />
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', background: 'color-mix(in oklab, white 60%, transparent)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--line)' }}>⌘K</span>
        </div>

        {/* Nav */}
        {NAV.map((n, i) =>
          'section' in n ? (
            <div key={'s' + i} className="eyebrow" style={{ padding: '12px 10px 4px' }}>{n.section}</div>
          ) : (
            <button
              key={n.id}
              className={`nav-item${tab === n.id ? ' active' : ''}`}
              onClick={() => setTab(n.id)}
            >
              <Icon name={n.icon} size={15} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.id === 'outstanding' && outstandingCount > 0 && (
                <span className="chip chip-accent" style={{ fontSize: 10, padding: '1px 6px' }}>{outstandingCount}</span>
              )}
              <span className="dot" />
            </button>
          )
        )}

        <div style={{ flex: 1 }} />

        {/* Account footer */}
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'color-mix(in oklab, white 60%, transparent)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(70% 0.12 165), oklch(55% 0.16 255))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>YO</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Youssef</div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Local device</div>
          </div>
          <Icon name="more" size={14} />
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px 40px' }}>
        <div style={{ maxWidth: 1440, marginLeft: 'auto', marginRight: 'auto' }}>
          {tab === 'dashboard' && <DashboardPage onNavigate={(t) => setTab(t as Tab)} />}
          {tab === 'import' && <ImportPage />}
          {tab === 'transactions' && <TransactionsPage />}
          {tab === 'budgets' && <BudgetsPage />}
          {tab === 'outstanding' && <OutstandingPage />}
          {tab === 'contacts' && <ContactsPage />}
          {tab === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
