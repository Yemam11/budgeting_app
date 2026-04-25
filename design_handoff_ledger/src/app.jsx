// Root app — places each page into a design-canvas artboard for side-by-side review

const PageFrame = ({ page }) => {
  const [current, setCurrent] = React.useState(page);
  return (
    <Shell page={current} setPage={setCurrent}>
      {current === 'dashboard' && <Dashboard/>}
      {current === 'transactions' && <TransactionsPage/>}
      {current === 'budgets' && <BudgetsPage/>}
      {current === 'import' && <ImportPage/>}
      {current === 'outstanding' && <OutstandingPage/>}
      {current === 'settings' && <SettingsPage/>}
    </Shell>
  );
};

// Dark variant wrapper — applies dark theme variables to a scoped root
const DarkFrame = ({ children }) => (
  <div style={{
    '--bg': 'oklch(14% 0.012 260)',
    '--bg-2': 'oklch(18% 0.015 260)',
    '--ink': 'oklch(96% 0.005 260)',
    '--ink-2': 'oklch(88% 0.008 260)',
    '--ink-soft': 'oklch(70% 0.01 260)',
    '--ink-mute': 'oklch(55% 0.012 260)',
    '--line': 'oklch(100% 0 0 / 0.08)',
    '--line-strong': 'oklch(100% 0 0 / 0.15)',
    '--glass-bg': 'color-mix(in oklab, oklch(30% 0.02 260) 50%, transparent)',
    '--glass-border': 'oklch(100% 0 0 / 0.1)',
    '--accent-soft': 'oklch(30% 0.08 165 / 0.3)',
    '--accent-ink': 'oklch(85% 0.12 165)',
    color: 'oklch(96% 0.005 260)',
  }}>
    {children}
  </div>
);

const App = () => (
  <DesignCanvas>
    <DCSection id="concept" title="Ledger — a calm, glassy budgeting app">
      <DCArtboard id="dashboard-light" label="Dashboard · Light" width={1440} height={900}>
        <PageFrame page="dashboard"/>
      </DCArtboard>
      <DCArtboard id="dashboard-dark" label="Dashboard · Dark" width={1440} height={900}>
        <DarkFrame><PageFrame page="dashboard"/></DarkFrame>
      </DCArtboard>
    </DCSection>

    <DCSection id="core" title="Core screens">
      <DCArtboard id="transactions" label="Transactions" width={1440} height={900}>
        <PageFrame page="transactions"/>
      </DCArtboard>
      <DCArtboard id="budgets" label="Budgets" width={1440} height={900}>
        <PageFrame page="budgets"/>
      </DCArtboard>
    </DCSection>

    <DCSection id="supporting" title="Supporting screens">
      <DCArtboard id="import" label="Import" width={1440} height={900}>
        <PageFrame page="import"/>
      </DCArtboard>
      <DCArtboard id="outstanding" label="Owed to you" width={1440} height={900}>
        <PageFrame page="outstanding"/>
      </DCArtboard>
      <DCArtboard id="settings" label="Settings" width={1440} height={900}>
        <PageFrame page="settings"/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
