// App shell — sidebar + main content

const Shell = ({ page, setPage, children }) => {
  const nav = [
    { section: 'General' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'transactions', label: 'Transactions', icon: 'transactions' },
    { id: 'budgets', label: 'Budgets', icon: 'budget' },
    { section: 'Tools' },
    { id: 'import', label: 'Import', icon: 'import' },
    { id: 'outstanding', label: 'Owed to you', icon: 'owed', badge: '4' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <div style={{ width: 1440, height: 900, display: 'flex', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient aurora reused inside the frame */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(700px 500px at 88% -10%, oklch(85% 0.12 165 / 0.35), transparent 60%), radial-gradient(600px 400px at 105% 45%, oklch(80% 0.12 300 / 0.20), transparent 60%), radial-gradient(600px 400px at -10% 90%, oklch(85% 0.08 220 / 0.18), transparent 60%)',
        pointerEvents: 'none',
      }}/>
      <aside style={{
        position: 'relative',
        width: 240,
        padding: '20px 14px',
        display: 'flex', flexDirection: 'column', gap: 4,
        borderRight: '1px solid var(--line)',
        background: 'color-mix(in oklab, white 45%, transparent)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px', borderBottom: '1px solid var(--line)', marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, oklch(22% 0.02 260), oklch(15% 0.02 260))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.15)',
            position: 'relative',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)', transform: 'rotate(45deg)' }}/>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Ledger</div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Local · Private</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)' }}>
            <Icon name="search" size={13}/>
          </div>
          <input className="input" placeholder="Quick search…" style={{ width: '100%', paddingLeft: 30, fontSize: 12 }}/>
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-mute)', background: 'color-mix(in oklab, white 60%, transparent)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--line)' }}>⌘K</span>
        </div>

        {/* Nav */}
        {nav.map((n, i) => n.section ? (
          <div key={'s'+i} className="eyebrow" style={{ padding: '12px 10px 4px' }}>{n.section}</div>
        ) : (
          <div key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            <Icon name={n.icon} size={15}/>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.badge && <span className="chip chip-accent" style={{ fontSize: 10, padding: '1px 6px' }}>{n.badge}</span>}
            <span className="dot"/>
          </div>
        ))}

        <div style={{ flex: 1 }}/>

        {/* Account footer */}
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'color-mix(in oklab, white 60%, transparent)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, oklch(70% 0.12 165), oklch(55% 0.16 255))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 13 }}>YO</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Youssef</div>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Local device</div>
          </div>
          <Icon name="more" size={14}/>
        </div>
      </aside>

      <main style={{ flex: 1, position: 'relative', overflow: 'auto', padding: '24px 28px 40px' }}>
        {children}
      </main>
    </div>
  );
};

window.Shell = Shell;
