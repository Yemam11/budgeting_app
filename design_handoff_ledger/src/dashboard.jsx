// Dashboard — hero screen

const Dashboard = () => {
  const thisMonth = '2026-04';
  const monthTxs = window.txsInMonth(thisMonth);
  const totals = window.categoryTotals(monthTxs);
  const spend = window.spendTotal(monthTxs);
  const income = window.incomeTotal(monthTxs);
  const net = income - spend;

  const prevMonth = '2026-03';
  const prevTxs = window.txsInMonth(prevMonth);
  const prevSpend = window.spendTotal(prevTxs);
  const prevIncome = window.incomeTotal(prevTxs);
  const spendDelta = ((spend - prevSpend) / prevSpend) * 100;
  const incomeDelta = ((income - prevIncome) / prevIncome) * 100;
  const netDelta = ((net - (prevIncome - prevSpend)) / (prevIncome - prevSpend)) * 100;

  // Pie data (top 6)
  const pieData = Array.from(totals.entries())
    .map(([id, v]) => ({ id, value: v, name: window.CAT_MAP[id]?.name ?? 'Uncat.', color: window.CAT_MAP[id]?.color ?? '#ccc' }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  // Cashflow (last 12 weeks synthetic)
  const cashflow = [
    { label: 'W1', income: 0, spend: 620 },
    { label: 'W2', income: 0, spend: 810 },
    { label: 'W3', income: 2125, spend: 540 },
    { label: 'W4', income: 0, spend: 920 },
    { label: 'W5', income: 0, spend: 380 },
    { label: 'W6', income: 2125, spend: 760 },
    { label: 'W7', income: 0, spend: 610 },
    { label: 'W8', income: 0, spend: 440 },
    { label: 'W9', income: 2125, spend: 880 },
    { label: 'W10', income: 0, spend: 920 },
    { label: 'W11', income: 62, spend: 710 },
    { label: 'W12', income: 2312, spend: 660 },
  ];

  // Stacked bars — 6 months
  const stackCats = ['groceries', 'food', 'bills-utilities', 'subscription', 'transportation', 'entertainment'].map(id => window.CAT_MAP[id]);
  const stackMonths = [
    { label: 'Nov', values: { groceries: 620, food: 340, 'bills-utilities': 2380, subscription: 65, transportation: 180, entertainment: 90 } },
    { label: 'Dec', values: { groceries: 710, food: 480, 'bills-utilities': 2420, subscription: 65, transportation: 150, entertainment: 240 } },
    { label: 'Jan', values: { groceries: 580, food: 290, 'bills-utilities': 2390, subscription: 70, transportation: 160, entertainment: 80 } },
    { label: 'Feb', values: { groceries: 640, food: 320, 'bills-utilities': 2410, subscription: 70, transportation: 140, entertainment: 110 } },
    { label: 'Mar', values: { groceries: 680, food: 380, 'bills-utilities': 2420, subscription: 70, transportation: 190, entertainment: 520 } },
    { label: 'Apr', values: { groceries: 680, food: 305, 'bills-utilities': 2438, subscription: 66, transportation: 102, entertainment: 58 } },
  ];

  // Sankey
  const inflows = [
    { label: 'Salary', value: 4250 },
    { label: 'Reimbursements', value: 187 },
  ];
  const outflows = [
    { label: 'Housing & Bills', value: 2438, color: 'oklch(68% 0.12 240)' },
    { label: 'Groceries', value: 680, color: 'oklch(72% 0.14 155)' },
    { label: 'Food & Café', value: 396, color: 'oklch(68% 0.16 25)' },
    { label: 'Transport', value: 201, color: 'oklch(68% 0.14 40)' },
    { label: 'Other', value: 520, color: 'oklch(65% 0.02 260)' },
    { label: 'Savings', value: 500, color: 'var(--accent)' },
  ];

  // Budget rows
  const budgetRows = window.BUDGETS
    .map(b => {
      const c = window.CAT_MAP[b.categoryId];
      const spent = totals.get(b.categoryId) ?? 0;
      return { c, limit: b.monthlyLimit, spent, pct: spent / b.monthlyLimit };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Overview · April 2026</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Good afternoon, Youssef</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost"><Icon name="calendar" size={14}/>Apr 1 – Apr 23</button>
          <button className="btn btn-ghost"><Icon name="download" size={14}/>Export</button>
          <button className="btn btn-primary"><Icon name="upload" size={14}/>Import statement</button>
        </div>
      </div>

      {/* Hero band — dark graphite with key figure */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, oklch(20% 0.015 260), oklch(15% 0.02 260))',
        borderRadius: 22,
        padding: '28px 32px',
        color: 'white',
        overflow: 'hidden',
        boxShadow: '0 20px 40px -20px oklch(15% 0.05 260 / 0.5), inset 0 1px 0 oklch(100% 0 0 / 0.08)',
        border: '1px solid oklch(30% 0.02 260)',
      }}>
        <div className="hero-pattern"/>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 8, fontWeight: 500 }}>Net this month</div>
              <div className="mono" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {window.fmtCAD(net)}
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Delta value={netDelta}/>
                <span style={{ fontSize: 12, color: 'oklch(65% 0.02 260)' }}>vs. March · {window.fmtCAD(prevIncome - prevSpend)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28, paddingBottom: 4 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Money in</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'var(--accent)' }}>+{window.fmtCAD(income)}</div>
                <Delta value={incomeDelta}/>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(70% 0.03 260)', marginBottom: 4 }}>Money out</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'oklch(95% 0.01 260)' }}>−{window.fmtCAD(spend)}</div>
                <Delta value={spendDelta} prefix=""/>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary"><Icon name="plus" size={14}/>New transaction</button>
            <button className="btn" style={{ background: 'oklch(100% 0 0 / 0.1)', color: 'white', border: '1px solid oklch(100% 0 0 / 0.15)' }}>
              <Icon name="split" size={14}/>Split expense
            </button>
            <button className="btn" style={{ background: 'oklch(100% 0 0 / 0.1)', color: 'white', border: '1px solid oklch(100% 0 0 / 0.15)' }}>
              <Icon name="more" size={14}/>
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Cashflow + Category donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Cash flow</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Weekly · last 12 weeks</div>
            </div>
            <div style={{ display: 'flex', gap: 4, padding: 3, background: 'oklch(50% 0.01 260 / 0.08)', borderRadius: 10 }}>
              {['Weekly','Daily','Monthly'].map((x, i) => (
                <button key={x} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 500,
                  borderRadius: 7, border: 'none',
                  background: i === 0 ? 'white' : 'transparent',
                  color: i === 0 ? 'var(--ink)' : 'var(--ink-mute)',
                  boxShadow: i === 0 ? 'var(--shadow-sm)' : 'none',
                }}>{x}</button>
              ))}
            </div>
          </div>
          <CashflowBars data={cashflow} height={200}/>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--ink-soft)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }}/>Income
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'oklch(35% 0.015 260)' }}/>Spending
            </span>
          </div>
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Where it went</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>{pieData.length} categories</div>
            </div>
            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>View all</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative' }}>
              <Donut data={pieData} size={160} thickness={18}/>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>Spent</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>{window.fmtCompact(spend)}</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pieData.slice(0, 5).map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <CatSwatch color={d.color} size={7}/>
                  <span style={{ flex: 1, color: 'var(--ink-2)' }}>{d.name}</span>
                  <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{window.fmtCompact(d.value)}</span>
                  <span className="mono" style={{ color: 'var(--ink-mute)', fontSize: 10, width: 32, textAlign: 'right' }}>{((d.value/spend)*100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Sankey */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Money flow</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>How April's income was allocated</div>
          </div>
          <span className="chip"><Icon name="sparkle" size={11}/>AI summary ready</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 4 }}>
          <div>Sources</div>
          <div style={{ textAlign: 'center' }}>Flow</div>
          <div style={{ textAlign: 'right' }}>Destinations</div>
        </div>
        <Sankey income={inflows} outflows={outflows} height={230}/>
      </div>

      {/* Row 3: Month-over-month + Budgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Spending trend</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>By category · last 6 months</div>
            </div>
          </div>
          <StackedBars months={stackMonths} categories={stackCats} height={200}/>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, fontSize: 11, color: 'var(--ink-soft)' }}>
            {stackCats.map(c => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CatSwatch color={c.color} size={7}/>{c.name}
              </span>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>Budget burn-down</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Day 23 of 30 · 77% through month</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {budgetRows.map(({ c, limit, spent, pct }) => {
              const over = pct > 1;
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ProgressRing pct={pct} size={40} thickness={4} color={c.color}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: over ? 'var(--danger)' : 'var(--ink-soft)' }}>
                        {window.fmtCompact(spent)} / {window.fmtCompact(limit)}
                      </div>
                    </div>
                    <div className="bar-track">
                      <div className={over ? 'bar-fill danger' : 'bar-fill'} style={{ width: Math.min(pct * 100, 100) + '%', background: over ? 'var(--danger)' : c.color }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 4: Recent activity */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 14px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Recent activity</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>Newest first · 8 needing review</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}><Icon name="filter" size={12}/>Filter</button>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}><Icon name="sort" size={12}/>Sort</button>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>View all</button>
          </div>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 96 }}>Date</th>
              <th>Merchant</th>
              <th style={{ width: 150 }}>Category</th>
              <th style={{ width: 120 }}>Confidence</th>
              <th style={{ width: 90 }}>Account</th>
              <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {window.TXS.slice(0, 6).map(t => {
              const c = t.categoryId ? window.CAT_MAP[t.categoryId] : null;
              const isIncome = t.type === 'income';
              return (
                <tr key={t.id}>
                  <td className="mono" style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{t.date.slice(5)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{t.merchantRaw}</div>
                    {t.split && <div style={{ fontSize: 11, color: 'oklch(58% 0.1 75)', marginTop: 2 }}>Split {t.split.people} ways · your share {window.fmtCAD(t.split.myShare)}</div>}
                    {t.notes && <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic', marginTop: 2 }}>{t.notes}</div>}
                  </td>
                  <td>
                    {c ? (
                      <span className="chip" style={{ background: `color-mix(in oklab, ${c.color}, transparent 86%)`, borderColor: `color-mix(in oklab, ${c.color}, transparent 70%)`, color: `color-mix(in oklab, ${c.color}, black 20%)` }}>
                        <CatSwatch color={c.color} size={6}/>{c.name}
                      </span>
                    ) : (
                      <span className="chip" style={{ color: 'var(--ink-mute)' }}>Uncategorized</span>
                    )}
                  </td>
                  <td>{(t.type === 'spend' || t.type === 'income') ? <ConfBar c={t.categoryConfidence}/> : <span style={{ color: 'var(--ink-mute)', fontSize: 11 }}>—</span>}</td>
                  <td><BankLogo bank={t.bank} size={20}/></td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 500, color: isIncome ? 'oklch(50% 0.15 160)' : 'var(--ink)' }}>
                    {isIncome ? '+' : ''}{window.fmtCAD(Math.abs(t.amount))}
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

window.Dashboard = Dashboard;
