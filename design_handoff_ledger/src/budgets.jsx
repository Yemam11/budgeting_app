// Budgets page

const BudgetsPage = () => {
  const thisMonth = '2026-04';
  const monthTxs = window.txsInMonth(thisMonth);
  const totals = window.categoryTotals(monthTxs);
  const budgetMap = new Map(window.BUDGETS.map(b => [b.categoryId, b.monthlyLimit]));

  const rows = window.CATEGORIES.filter(c => !c.isIncome).map(c => {
    const spent = totals.get(c.id) ?? 0;
    const limit = budgetMap.get(c.id) ?? 0;
    const pct = limit > 0 ? spent / limit : 0;
    return { c, spent, limit, pct };
  }).sort((a, b) => (b.limit > 0 ? 1 : 0) - (a.limit > 0 ? 1 : 0) || b.pct - a.pct);

  const totalBudget = window.BUDGETS.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const dayOfMonth = 23, daysInMonth = 30;
  const expected = totalBudget * (dayOfMonth / daysInMonth);
  const pace = totalSpent - expected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Budgets</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Monthly limits</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>April 2026 · Day {dayOfMonth} of {daysInMonth}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost"><Icon name="calendar" size={14}/>April 2026</button>
          <button className="btn btn-ghost">Copy from March</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/>Add budget</button>
        </div>
      </div>

      {/* Hero summary */}
      <div className="glass" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 32, alignItems: 'center' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Spent this month</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>{window.fmtCAD(totalSpent)}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>of {window.fmtCAD(totalBudget)} budgeted</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Remaining</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: 'oklch(50% 0.15 160)' }}>{window.fmtCAD(totalBudget - totalSpent)}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>7 days left in April</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pace</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: pace > 0 ? 'var(--danger)' : 'oklch(50% 0.15 160)' }}>
            {pace > 0 ? '+' : ''}{window.fmtCAD(pace)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>{pace > 0 ? 'Above' : 'Below'} expected pace</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Overall progress</div>
          <div className="bar-track" style={{ height: 10, marginBottom: 8 }}>
            <div className="bar-fill" style={{ width: Math.min((totalSpent / totalBudget) * 100, 100) + '%', background: 'linear-gradient(90deg, var(--accent), oklch(70% 0.16 165))' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
            <span>{Math.round((totalSpent / totalBudget) * 100)}%</span>
            <span style={{ position: 'relative', paddingLeft: 10 }}>
              <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 2, height: 10, background: 'var(--ink)', opacity: 0.4 }}/>
              Expected {Math.round((dayOfMonth / daysInMonth) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Budget table */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>All categories</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="chip chip-accent"><Icon name="check" size={10}/>9 on track</span>
            <span className="chip" style={{ background: 'oklch(95% 0.05 75)', borderColor: 'oklch(80% 0.1 75)', color: 'oklch(50% 0.14 75)' }}>1 at risk</span>
            <span className="chip chip-danger">1 over</span>
          </div>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ width: 110, textAlign: 'right' }}>Spent</th>
              <th style={{ width: 140, textAlign: 'right' }}>Monthly limit</th>
              <th style={{ width: 260 }}>Progress</th>
              <th style={{ width: 110, textAlign: 'right' }}>Remaining</th>
              <th style={{ width: 70, textAlign: 'right' }}>Pace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, spent, limit, pct }) => {
              const over = limit > 0 && spent > limit;
              const expectedCat = limit * (dayOfMonth / daysInMonth);
              const paceCat = spent - expectedCat;
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CatSwatch color={c.color} size={8}/>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{limit > 0 ? window.fmtCAD(spent) : <span style={{ color: 'var(--ink-mute)', fontWeight: 400 }}>{window.fmtCAD(spent)}</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    {limit > 0 ? (
                      <span className="mono" style={{ fontWeight: 500 }}>{window.fmtCAD(limit)}</span>
                    ) : (
                      <button style={{ background: 'transparent', border: '1px dashed var(--line-strong)', padding: '3px 10px', borderRadius: 7, fontSize: 11, color: 'var(--ink-mute)', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                        Set limit
                      </button>
                    )}
                  </td>
                  <td>
                    {limit > 0 ? (
                      <div style={{ position: 'relative' }}>
                        <div className="bar-track" style={{ height: 6 }}>
                          <div className={over ? 'bar-fill danger' : 'bar-fill'} style={{ width: Math.min(pct * 100, 100) + '%', background: over ? 'var(--danger)' : c.color }}/>
                        </div>
                        <div style={{ position: 'absolute', top: -2, left: `${(dayOfMonth / daysInMonth) * 100}%`, width: 1, height: 10, background: 'var(--ink)', opacity: 0.35 }}/>
                      </div>
                    ) : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: over ? 'var(--danger)' : 'var(--ink-2)', fontWeight: 500 }}>
                    {limit > 0 ? (over ? '−' : '') + window.fmtCAD(Math.abs(limit - spent)) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {limit > 0 && <Delta value={(paceCat / limit) * 100} prefix={paceCat > 0 ? '+' : ''}/>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

window.BudgetsPage = BudgetsPage;
