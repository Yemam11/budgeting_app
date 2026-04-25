import { useEffect, useState } from 'react';
import { ensureSeeded } from './lib/seed';
import { DashboardPage } from './pages/Dashboard';
import { ImportPage } from './pages/Import';
import { TransactionsPage } from './pages/Transactions';
import { BudgetsPage } from './pages/Budgets';
import { OutstandingPage } from './pages/Outstanding';
import { SettingsPage } from './pages/Settings';

type Tab = 'dashboard' | 'import' | 'transactions' | 'budgets' | 'outstanding' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'import', label: 'Import' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'outstanding', label: 'Owed to me' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }

  return (
    <div className="min-h-full flex">
      <aside className="w-52 border-r border-slate-200 bg-white p-4 space-y-1">
        <div className="px-2 pb-3 mb-3 border-b border-slate-100">
          <div className="text-sm font-semibold tracking-tight">Budget</div>
          <div className="text-xs text-slate-500">Local · private</div>
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`w-full text-left px-3 py-1.5 rounded text-sm ${
              tab === t.id ? 'bg-sky-100 text-sky-800 font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'import' && <ImportPage />}
        {tab === 'transactions' && <TransactionsPage />}
        {tab === 'budgets' && <BudgetsPage />}
        {tab === 'outstanding' && <OutstandingPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
