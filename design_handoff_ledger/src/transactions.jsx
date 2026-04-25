// Transactions page

const TransactionsPage = () => {
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filters = [
    { id: 'all', label: 'All', count: window.TXS.length },
    { id: 'needs-review', label: 'Needs review', count: 8 },
    { id: 'spend', label: 'Spend', count: 32 },
    { id: 'income', label: 'Income', count: 4 },
    { id: 'transfer', label: 'Transfer', count: 1 },
    { id: 'cc-payment', label: 'CC payment', count: 2 },
  ];

  const rows = window.TXS.slice(0, 16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ledger</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Transactions</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{window.TXS.length.toLocaleString()} entries · 3 banks · April 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost"><Icon name="calendar" size={14}/>Apr 2026</button>
          <button className="btn btn-ghost"><Icon name="download" size={14}/>Export CSV</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/>Add transaction</button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total spend', value: '$4,238.10', delta: 6.2, tone: 'default' },
          { label: 'Income', value: '$4,437.50', delta: 4.4, tone: 'accent' },
          { label: 'Needs review', value: '8 txns', sub: '4 below 70% confidence', tone: 'warn' },
          { label: 'Outstanding', value: '$136.25', sub: '4 people owe you', tone: 'default' },
        ].map(s => (
          <div key={s.label} className="glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: s.tone === 'accent' ? 'oklch(50% 0.15 160)' : s.tone === 'warn' ? 'oklch(55% 0.14 75)' : 'var(--ink)' }}>{s.value}</div>
            {s.delta !== undefined && <div style={{ marginTop: 4 }}><Delta value={s.delta}/></div>}
            {s.sub && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="glass" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>
            <Icon name="search" size={14}/>
          </div>
          <input className="input" style={{ paddingLeft: 30, width: '100%' }} placeholder="Search merchant, note, amount…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'oklch(50% 0.01 260 / 0.08)', borderRadius: 10 }}>
          {filters.map(f => (
            <button key={f.id} onClick={() => setTypeFilter(f.id)} style={{
              padding: '5px 10px', fontSize: 12, fontWeight: 500, borderRadius: 7, border: 'none',
              background: typeFilter === f.id ? 'white' : 'transparent',
              color: typeFilter === f.id ? 'var(--ink)' : 'var(--ink-soft)',
              boxShadow: typeFilter === f.id ? 'var(--shadow-sm)' : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {f.label}
              <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        <button className="btn btn-ghost"><Icon name="filter" size={12}/>More filters</button>
        <button className="btn btn-ghost"><Icon name="sort" size={12}/>Date ↓</button>
      </div>

      {/* Table */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" style={{ accentColor: 'var(--accent)' }}/></th>
              <th style={{ width: 80 }}>Date</th>
              <th style={{ width: 64 }}>Bank</th>
              <th>Merchant</th>
              <th style={{ width: 80 }}>Type</th>
              <th style={{ width: 170 }}>Category</th>
              <th style={{ width: 110 }}>Confidence</th>
              <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => {
              const c = t.categoryId ? window.CAT_MAP[t.categoryId] : null;
              const isIncome = t.type === 'income';
              const needsReview = t.type === 'spend' && t.categoryConfidence < 0.9 && t.categorySource !== 'user';
              return (
                <tr key={t.id}>
                  <td><input type="checkbox" style={{ accentColor: 'var(--accent)' }}/></td>
                  <td className="mono" style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{t.date.slice(5)}</td>
                  <td><BankLogo bank={t.bank} size={20}/></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>{t.merchantRaw}</span>
                      {needsReview && <span className="chip" style={{ fontSize: 10, padding: '1px 6px', background: 'oklch(95% 0.05 75)', borderColor: 'oklch(80% 0.1 75)', color: 'oklch(50% 0.14 75)' }}>review</span>}
                    </div>
                    {t.split && <div style={{ fontSize: 11, color: 'oklch(58% 0.1 75)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="split" size={10}/>Split {t.split.people} ways · {window.fmtCAD(t.split.myShare)} mine
                    </div>}
                    {t.notes && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', marginTop: 2 }}>"{t.notes}"</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: 'var(--mono)', background: 'oklch(50% 0.01 260 / 0.06)', padding: '2px 6px', borderRadius: 6 }}>
                      {t.type}
                    </span>
                  </td>
                  <td>
                    {c ? (
                      <span className="chip" style={{ background: `color-mix(in oklab, ${c.color}, transparent 86%)`, borderColor: `color-mix(in oklab, ${c.color}, transparent 70%)`, color: `color-mix(in oklab, ${c.color}, black 20%)`, cursor: 'pointer' }}>
                        <CatSwatch color={c.color} size={6}/>{c.name}
                        <Icon name="chevron_down" size={10}/>
                      </span>
                    ) : (t.type === 'spend' || t.type === 'income') ? (
                      <span className="chip" style={{ color: 'var(--ink-mute)', cursor: 'pointer' }}>Uncategorized<Icon name="chevron_down" size={10}/></span>
                    ) : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
                  </td>
                  <td>{(t.type === 'spend' || t.type === 'income') && t.categoryConfidence > 0 ? <ConfBar c={t.categoryConfidence}/> : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500, color: isIncome ? 'oklch(50% 0.15 160)' : 'var(--ink)' }}>
                    {isIncome ? '+' : ''}{window.fmtCAD(Math.abs(t.amount))}
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ padding: 4, border: 'none', background: 'transparent', color: 'var(--ink-mute)' }}>
                      <Icon name="more" size={16}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-mute)' }}>
          <div>Showing 1–16 of 43</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>Previous</button>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

window.TransactionsPage = TransactionsPage;
