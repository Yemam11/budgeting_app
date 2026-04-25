// Custom SVG charts — cashflow bars, donut, stacked bars, sankey, progress rings

const CashflowBars = ({ data, height = 200, theme = 'light' }) => {
  // data: [{label, income, spend}]
  const max = Math.max(...data.flatMap(d => [d.income, d.spend])) * 1.15;
  const W = 600, H = height;
  const pad = { t: 12, r: 8, b: 24, l: 36 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const bw = iw / data.length * 0.7;
  const gap = iw / data.length * 0.3;
  const gridColor = theme === 'dark' ? 'oklch(100% 0 0 / 0.08)' : 'oklch(50% 0.01 260 / 0.1)';
  const labelColor = theme === 'dark' ? 'oklch(70% 0.01 260)' : 'var(--ink-mute)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {[0, 0.5, 1].map(t => {
        const y = pad.t + ih * (1 - t);
        return <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={gridColor} strokeDasharray="2 3"/>
          <text x={pad.l - 6} y={y + 3} fontSize="9" fill={labelColor} textAnchor="end" fontFamily="var(--mono)">
            ${Math.round(max * t / 1000)}k
          </text>
        </g>;
      })}
      {data.map((d, i) => {
        const x = pad.l + i * (bw + gap) + gap / 2;
        const iH = (d.income / max) * ih;
        const sH = (d.spend / max) * ih;
        return <g key={i}>
          <rect x={x} y={pad.t + ih - iH} width={bw * 0.45} height={iH} rx={3} fill="var(--accent)" opacity={0.95}/>
          <rect x={x + bw * 0.5} y={pad.t + ih - sH} width={bw * 0.45} height={sH} rx={3} fill={theme === 'dark' ? 'oklch(75% 0.01 260)' : 'oklch(35% 0.015 260)'} opacity={0.85}/>
          <text x={x + bw / 2} y={H - 8} fontSize="10" fill={labelColor} textAnchor="middle" fontFamily="var(--sans)">{d.label}</text>
        </g>;
      })}
    </svg>
  );
};

const Donut = ({ data, size = 200, thickness = 24 }) => {
  // data: [{label, value, color}]
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - thickness / 2 - 2;
  const c = size / 2;
  let acc = 0;
  const segs = data.map(d => {
    const frac = d.value / total;
    const a0 = acc * Math.PI * 2 - Math.PI / 2;
    acc += frac;
    const a1 = acc * Math.PI * 2 - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    return { d, path: `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}` };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="oklch(50% 0.01 260 / 0.08)" strokeWidth={thickness}/>
      {segs.map((s, i) => (
        <path key={i} d={s.path} fill="none" stroke={s.d.color} strokeWidth={thickness} strokeLinecap="butt"/>
      ))}
    </svg>
  );
};

const StackedBars = ({ months, categories, height = 200, theme = 'light' }) => {
  // months: [{label, values: {catId: amount}}], categories: [{id,name,color}]
  const totals = months.map(m => Object.values(m.values).reduce((a, b) => a + b, 0));
  const max = Math.max(...totals) * 1.15;
  const W = 600, H = height;
  const pad = { t: 12, r: 8, b: 24, l: 36 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const bw = iw / months.length * 0.65;
  const gap = iw / months.length * 0.35;
  const gridColor = theme === 'dark' ? 'oklch(100% 0 0 / 0.08)' : 'oklch(50% 0.01 260 / 0.1)';
  const labelColor = theme === 'dark' ? 'oklch(70% 0.01 260)' : 'var(--ink-mute)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {[0, 0.5, 1].map(t => {
        const y = pad.t + ih * (1 - t);
        return <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={gridColor} strokeDasharray="2 3"/>
          <text x={pad.l - 6} y={y + 3} fontSize="9" fill={labelColor} textAnchor="end" fontFamily="var(--mono)">${Math.round(max * t / 1000)}k</text>
        </g>;
      })}
      {months.map((m, i) => {
        let cy = pad.t + ih;
        const x = pad.l + i * (bw + gap) + gap / 2;
        return <g key={i}>
          {categories.map(c => {
            const v = m.values[c.id] ?? 0;
            if (v <= 0) return null;
            const h = (v / max) * ih;
            cy -= h;
            return <rect key={c.id} x={x} y={cy} width={bw} height={h - 1} fill={c.color} opacity={0.88}/>;
          })}
          <text x={x + bw / 2} y={H - 8} fontSize="10" fill={labelColor} textAnchor="middle">{m.label}</text>
        </g>;
      })}
    </svg>
  );
};

const AreaSpark = ({ data, color = 'var(--accent)', height = 48, fill = true }) => {
  const W = 160, H = height;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${H - 4 - ((v - min) / range) * (H - 8)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity={0.15}/>}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const ProgressRing = ({ pct, size = 56, thickness = 5, color = 'var(--accent)', label }) => {
  const r = size / 2 - thickness / 2 - 1;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(pct, 1);
  const over = pct > 1;
  const fill = over ? 'var(--danger)' : color;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="oklch(50% 0.01 260 / 0.1)" strokeWidth={thickness}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fill} strokeWidth={thickness}
          strokeDasharray={`${clamped * circ} ${circ}`} strokeDashoffset={0} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
      </svg>
      {label && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 500, color: over ? 'var(--danger)' : 'var(--ink-2)' }}>
          {label}
        </div>
      )}
    </div>
  );
};

const Sankey = ({ income, outflows, height = 230, theme = 'light' }) => {
  // income: [{label, value}], outflows: [{label, value, color}]
  const W = 620, H = height;
  const totalIn = income.reduce((s, d) => s + d.value, 0);
  const totalOut = outflows.reduce((s, d) => s + d.value, 0);
  const total = Math.max(totalIn, totalOut);
  const scale = (H - 40) / total;
  const leftX = 20, midX = 220, midX2 = 380, rightX = 590;
  const nodeW = 10;

  // Positions
  let lY = 20;
  const lNodes = income.map(d => {
    const h = d.value * scale;
    const node = { ...d, y: lY, h };
    lY += h + 8;
    return node;
  });
  let rY = 20;
  const rNodes = outflows.map(d => {
    const h = d.value * scale;
    const node = { ...d, y: rY, h };
    rY += h + 4;
    return node;
  });
  const hubY = 20, hubH = total * scale;

  // Ribbons left→hub
  let hubAccTop = hubY;
  const leftRibbons = lNodes.map(n => {
    const y0 = n.y, y1 = hubAccTop;
    hubAccTop += n.h;
    return { path: `M${leftX + nodeW} ${y0} C${(leftX + midX)/2} ${y0}, ${(leftX + midX)/2} ${y1}, ${midX} ${y1} L${midX} ${y1 + n.h} C${(leftX + midX)/2} ${y1 + n.h}, ${(leftX + midX)/2} ${y0 + n.h}, ${leftX + nodeW} ${y0 + n.h} Z`, color: 'var(--accent)' };
  });
  // Ribbons hub→right
  let hubAccBot = hubY;
  const rightRibbons = rNodes.map(n => {
    const y0 = hubAccBot, y1 = n.y;
    hubAccBot += n.h;
    return { path: `M${midX2} ${y0} C${(midX2 + rightX)/2} ${y0}, ${(midX2 + rightX)/2} ${y1}, ${rightX - nodeW} ${y1} L${rightX - nodeW} ${y1 + n.h} C${(midX2 + rightX)/2} ${y1 + n.h}, ${(midX2 + rightX)/2} ${y0 + n.h}, ${midX2} ${y0 + n.h} Z`, color: n.color };
  });

  const textColor = theme === 'dark' ? 'oklch(85% 0.01 260)' : 'var(--ink-2)';
  const muteColor = theme === 'dark' ? 'oklch(65% 0.01 260)' : 'var(--ink-mute)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {leftRibbons.map((r, i) => <path key={'l'+i} d={r.path} fill={r.color} opacity={0.35}/>)}
      {rightRibbons.map((r, i) => <path key={'r'+i} d={r.path} fill={r.color} opacity={0.4}/>)}
      {lNodes.map((n, i) => <g key={'ln'+i}>
        <rect x={leftX} y={n.y} width={nodeW} height={n.h} rx={2} fill="var(--accent)"/>
        <text x={leftX - 8} y={n.y + n.h/2 + 4} fontSize="10" fill={textColor} textAnchor="end" fontWeight="500">{n.label}</text>
        <text x={leftX - 8} y={n.y + n.h/2 + 16} fontSize="9" fill={muteColor} textAnchor="end" fontFamily="var(--mono)">${(n.value/1000).toFixed(1)}k</text>
      </g>)}
      <rect x={midX} y={hubY} width={nodeW} height={hubH} rx={2} fill={theme === 'dark' ? 'oklch(80% 0.01 260)' : 'oklch(30% 0.015 260)'}/>
      <rect x={midX2 - nodeW} y={hubY} width={nodeW} height={hubAccBot - hubY} rx={2} fill={theme === 'dark' ? 'oklch(80% 0.01 260)' : 'oklch(30% 0.015 260)'}/>
      {rNodes.map((n, i) => <g key={'rn'+i}>
        <rect x={rightX - nodeW} y={n.y} width={nodeW} height={n.h} rx={2} fill={n.color}/>
        <text x={rightX + 4} y={n.y + n.h/2 + 4} fontSize="10" fill={textColor} fontWeight="500">{n.label}</text>
        <text x={rightX + 4} y={n.y + n.h/2 + 16} fontSize="9" fill={muteColor} fontFamily="var(--mono)">${(n.value/1000).toFixed(1)}k</text>
      </g>)}
    </svg>
  );
};

Object.assign(window, { CashflowBars, Donut, StackedBars, AreaSpark, ProgressRing, Sankey });
