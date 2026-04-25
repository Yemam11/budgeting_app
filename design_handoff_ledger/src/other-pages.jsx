// Import, Outstanding, Settings pages

const ImportPage = () => {
  const recentImports = [
    { bank: 'amex', file: 'amex_april_2026.csv', count: 42, date: '2026-04-23 14:22', status: 'ok' },
    { bank: 'bmo', file: 'bmo_chequing_apr.csv', count: 18, date: '2026-04-23 14:21', status: 'ok' },
    { bank: 'scotia', file: 'scotia_visa_apr.csv', count: 12, date: '2026-04-20 09:45', status: 'ok' },
    { bank: 'amex', file: 'amex_march_2026.csv', count: 38, date: '2026-03-31 18:02', status: 'partial' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Data</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Import statements</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 580 }}>
          Drop CSV exports from your bank. Everything is parsed, categorized and stored locally — your data never leaves this device.
        </div>
      </div>

      {/* Dropzone */}
      <div className="glass" style={{ padding: 36, textAlign: 'center', border: '1.5px dashed color-mix(in oklab, var(--accent), transparent 50%)', background: 'color-mix(in oklab, var(--accent-soft), white 50%)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent), transparent 60%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-ink)', marginBottom: 14 }}>
          <Icon name="upload" size={22}/>
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Drop CSV files anywhere</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>Supports Amex, BMO, and Scotiabank exports · up to 20 files</div>
        <button className="btn btn-primary">Choose files</button>
      </div>

      {/* Supported banks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { bank: 'amex', name: 'American Express', hint: 'Export → Activity → .csv' },
          { bank: 'bmo', name: 'BMO', hint: 'Transactions → Download .csv' },
          { bank: 'scotia', name: 'Scotiabank', hint: 'Statements → Export .csv' },
        ].map(b => (
          <div key={b.bank} className="glass" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <BankLogo bank={b.bank} size={36}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{b.hint}</div>
            </div>
            <span className="chip chip-accent"><Icon name="check" size={10}/>Ready</span>
          </div>
        ))}
      </div>

      {/* Recent imports */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Recent imports</div>
          <span className="chip"><Icon name="shield" size={11}/>Local-only storage</span>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Bank</th>
              <th>File</th>
              <th style={{ width: 80, textAlign: 'right' }}>Rows</th>
              <th style={{ width: 150 }}>Imported</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {recentImports.map((r, i) => (
              <tr key={i}>
                <td><BankLogo bank={r.bank} size={22}/></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="file" size={14} stroke={1.4}/>
                    <span className="mono" style={{ fontSize: 12 }}>{r.file}</span>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right' }}>{r.count}</td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.date}</td>
                <td>
                  {r.status === 'ok' ? <span className="chip chip-accent"><Icon name="check" size={10}/>Imported</span> :
                   <span className="chip" style={{ background: 'oklch(95% 0.05 75)', borderColor: 'oklch(80% 0.1 75)', color: 'oklch(50% 0.14 75)' }}>2 dupes skipped</span>}
                </td>
                <td><button className="btn btn-ghost" style={{ padding: 4, border: 'none', background: 'transparent' }}><Icon name="more" size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OutstandingPage = () => {
  const byPerson = [
    { name: 'Aisha', amount: 39.00, entries: 1 },
    { name: 'Marcus', amount: 39.00, entries: 1 },
    { name: 'Jen', amount: 39.00, entries: 1 },
    { name: 'Dani', amount: 19.25, entries: 1 },
  ];
  const proposals = [
    { person: 'Sarah K.', amount: 62.50, from: 'IZAKAYA JU · 2026-04-19', inflow: 'E-Transfer 2026-04-22', days: 3 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Splits</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Owed to you</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 640 }}>
          Created automatically from split transactions. E-Transfer inflows matching an open amount are proposed as settlements.
        </div>
      </div>

      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Total outstanding</div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em' }}>$136.25</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>across 4 people · 4 transactions</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {byPerson.map(p => (
            <div key={p.name} style={{ padding: 14, borderRadius: 12, background: 'color-mix(in oklab, white 60%, transparent)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `oklch(70% 0.08 ${p.name.charCodeAt(0) * 7 % 360})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 500 }}>{p.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{p.entries} open</div>
                </div>
                <div className="mono" style={{ fontWeight: 500 }}>{window.fmtCAD(p.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {proposals.length > 0 && (
        <div className="glass" style={{ padding: 18, background: 'color-mix(in oklab, oklch(95% 0.05 75), white 50%)', border: '1px solid oklch(80% 0.1 75 / 0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="sparkle" size={14}/>
            <div style={{ fontWeight: 500, fontSize: 13 }}>Possible settlements ({proposals.length})</div>
          </div>
          {proposals.map((p, i) => (
            <div key={i} style={{ background: 'white', padding: 14, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 13 }}><span style={{ fontWeight: 500 }}>{p.person}</span> may have repaid <span className="mono" style={{ fontWeight: 500 }}>{window.fmtCAD(p.amount)}</span></div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>From {p.from} · matched inflow {p.inflow} ({p.days} days later)</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}>Not a match</button>
                <button className="btn btn-primary" style={{ fontSize: 12 }}><Icon name="check" size={12}/>Confirm settled</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', fontWeight: 500, fontSize: 13 }}>Outstanding (4)</div>
        <table className="data">
          <thead>
            <tr>
              <th>Person</th>
              <th>Originated from</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {[
              { p: 'Aisha', from: 'IZAKAYA JU', d: '2026-04-19', a: 39.00 },
              { p: 'Marcus', from: 'IZAKAYA JU', d: '2026-04-19', a: 39.00 },
              { p: 'Jen', from: 'IZAKAYA JU', d: '2026-04-19', a: 39.00 },
              { p: 'Dani', from: 'CINEPLEX ODEON VARSITY', d: '2026-04-11', a: 19.25 },
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r.p}</td>
                <td>{r.from}</td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.d}</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{window.fmtCAD(r.a)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>Mark paid</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const Section = ({ title, desc, children }) => (
    <div className="glass" style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Preferences</div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Settings</div>
      </div>

      <Section title="Categorization" desc="Control how transactions are auto-categorized on import.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Confidence threshold for auto-categorization</div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--accent-ink)', fontWeight: 500 }}>85%</div>
            </div>
            <div style={{ position: 'relative', height: 6, background: 'oklch(50% 0.01 260 / 0.1)', borderRadius: 999 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '85%', background: 'var(--accent)', borderRadius: 999 }}/>
              <div style={{ position: 'absolute', left: '85%', top: '50%', width: 14, height: 14, borderRadius: '50%', background: 'white', border: '2px solid var(--accent)', transform: 'translate(-50%, -50%)', boxShadow: 'var(--shadow-sm)' }}/>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}>Transactions below this confidence are flagged for review.</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Propagate category changes to past merchants</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>When you re-categorize, update other transactions from the same merchant.</div>
            </div>
            <Toggle on={true}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Exclude "owed" amounts from spending totals</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>Split transactions only count your share.</div>
            </div>
            <Toggle on={true}/>
          </div>
        </div>
      </Section>

      <Section title="Data & privacy" desc="Your data stays on this device.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'color-mix(in oklab, var(--accent-soft), white 60%)', borderRadius: 10, border: '1px solid color-mix(in oklab, var(--accent), transparent 70%)' }}>
            <Icon name="lock" size={18}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Local-only mode</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Stored in browser (IndexedDB) · 312 txns · 86 KB · never uploaded</div>
            </div>
            <span className="chip chip-accent">Active</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost"><Icon name="download" size={13}/>Export backup (.json)</button>
            <button className="btn btn-ghost"><Icon name="upload" size={13}/>Restore backup</button>
            <div style={{ flex: 1 }}/>
            <button className="btn" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger), transparent 70%)' }}>Clear all data</button>
          </div>
        </div>
      </Section>

      <Section title="Categories" desc="19 active · manage colors, names, and archive.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {window.CATEGORIES.map(c => (
            <div key={c.id} className="chip" style={{ background: `color-mix(in oklab, ${c.color}, transparent 86%)`, borderColor: `color-mix(in oklab, ${c.color}, transparent 70%)`, color: `color-mix(in oklab, ${c.color}, black 20%)` }}>
              <CatSwatch color={c.color} size={6}/>{c.name}
            </div>
          ))}
          <button className="chip" style={{ background: 'transparent', borderStyle: 'dashed', cursor: 'pointer' }}>
            <Icon name="plus" size={10}/>New category
          </button>
        </div>
      </Section>
    </div>
  );
};

const Toggle = ({ on }) => (
  <div style={{ width: 36, height: 20, borderRadius: 999, background: on ? 'var(--accent)' : 'oklch(50% 0.01 260 / 0.2)', position: 'relative', transition: 'background .2s', cursor: 'pointer', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)' }}>
    <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .2s' }}/>
  </div>
);

Object.assign(window, { ImportPage, OutstandingPage, SettingsPage, Toggle });
