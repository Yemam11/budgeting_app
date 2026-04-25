import type { FC } from 'react';

const fmtAxis = (v: number) => {
  if (v === 0) return '$0';
  if (v >= 10000) return `$${Math.round(v / 1000)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
};

type CashflowDatum = { label: string; income: number; spend: number };

export const CashflowBars: FC<{ data: CashflowDatum[]; height?: number }> = ({ data, height = 200 }) => {
  const max = Math.max(...data.flatMap(d => [d.income, d.spend]), 1) * 1.15;
  const W = 600, H = height;
  const pad = { t: 12, r: 8, b: 24, l: 44 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const bw = iw / data.length * 0.7;
  const gap = iw / data.length * 0.3;
  const grid = 'oklch(50% 0.01 260 / 0.1)';
  const lbl = 'var(--ink-mute)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {[0, 0.5, 1].map(t => {
        const y = pad.t + ih * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={grid} strokeDasharray="2 3" />
            <text x={pad.l - 6} y={y + 3} fontSize="9" fill={lbl} textAnchor="end" fontFamily="var(--mono)">
              {fmtAxis(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + i * (bw + gap) + gap / 2;
        const iH = (d.income / max) * ih;
        const sH = (d.spend / max) * ih;
        return (
          <g key={i}>
            <rect x={x} y={pad.t + ih - iH} width={bw * 0.45} height={iH} rx={3} fill="var(--accent)" opacity={0.95} />
            <rect x={x + bw * 0.5} y={pad.t + ih - sH} width={bw * 0.45} height={sH} rx={3} fill="oklch(35% 0.015 260)" opacity={0.85} />
            <text x={x + bw / 2} y={H - 8} fontSize="10" fill={lbl} textAnchor="middle" fontFamily="var(--sans)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

type DonutDatum = { label: string; value: number; color: string };

export const Donut: FC<{ data: DonutDatum[]; size?: number; thickness?: number }> = ({ data, size = 200, thickness = 24 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <svg width={size} height={size} />;
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
      <circle cx={c} cy={c} r={r} fill="none" stroke="oklch(50% 0.01 260 / 0.08)" strokeWidth={thickness} />
      {segs.map((s, i) => (
        <path key={i} d={s.path} fill="none" stroke={s.d.color} strokeWidth={thickness} strokeLinecap="butt" />
      ))}
    </svg>
  );
};

type StackedMonth = { label: string; values: Record<string, number> };
type StackedCat = { id: string; name: string; color: string };

export const StackedBars: FC<{ months: StackedMonth[]; categories: StackedCat[]; height?: number }> = ({ months, categories, height = 200 }) => {
  const totals = months.map(m => Object.values(m.values).reduce((a, b) => a + b, 0));
  const max = Math.max(...totals, 1) * 1.15;
  const W = 600, H = height;
  const pad = { t: 12, r: 8, b: 24, l: 44 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const bw = iw / months.length * 0.65;
  const gap = iw / months.length * 0.35;
  const grid = 'oklch(50% 0.01 260 / 0.1)';
  const lbl = 'var(--ink-mute)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {[0, 0.5, 1].map(t => {
        const y = pad.t + ih * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={grid} strokeDasharray="2 3" />
            <text x={pad.l - 6} y={y + 3} fontSize="9" fill={lbl} textAnchor="end" fontFamily="var(--mono)">{fmtAxis(max * t)}</text>
          </g>
        );
      })}
      {months.map((m, i) => {
        const x = pad.l + i * (bw + gap) + gap / 2;
        let barY = pad.t + ih;
        const rects: React.ReactNode[] = [];
        for (const c of categories) {
          const v = m.values[c.id] ?? 0;
          if (v <= 0) continue;
          const h = (v / max) * ih;
          rects.push(<rect key={c.id} x={x} y={barY - h} width={bw} height={Math.max(h - 1, 0)} fill={c.color} opacity={0.88} />);
          barY -= h;
        }
        return (
          <g key={i}>
            {rects}
            <text x={x + bw / 2} y={H - 8} fontSize="10" fill={lbl} textAnchor="middle">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

type SankeyInflow = { label: string; value: number };
type SankeyOutflow = { label: string; value: number; color: string };

const truncate = (s: string, max = 14) => s.length > max ? s.slice(0, max - 1) + '…' : s;

export const Sankey: FC<{ income: SankeyInflow[]; outflows: SankeyOutflow[]; height?: number }> = ({ income, outflows, height = 230 }) => {
  if (income.length === 0 && outflows.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>No data yet</div>;
  }
  const W = 700, H = height;
  const leftX = 140, midX = 270, midX2 = 430, rightX = 570, nodeW = 10;
  const usableH = H - 40;
  const startY = 20;

  const totalIn = income.reduce((s, d) => s + d.value, 0);
  const totalOut = outflows.reduce((s, d) => s + d.value, 0);
  // Scale by the larger of the two so nodes never exceed usableH
  const scaleBase = Math.max(totalIn, totalOut, 1);
  const scale = usableH / scaleBase;

  // Left nodes — proportional to their actual value
  let lY = startY;
  const lNodes = income.map((d, i) => {
    const h = Math.max(d.value * scale, 4);
    const n = { ...d, y: lY, h };
    lY += h + (i < income.length - 1 ? 6 : 0);
    return n;
  });

  // Hub height = left total (income)
  const hubH = totalIn * scale;

  // Right nodes — normalized so they sum to hubH (proportional allocation of income)
  // This prevents right side from overflowing when spend >> income
  const rGap = 2;
  const rGapTotal = Math.max(outflows.length - 1, 0) * rGap;
  const rAvail = Math.max(hubH - rGapTotal, 4);
  let rY = startY;
  const rNodes = outflows.map((d, i) => {
    const h = totalOut > 0 ? Math.max((d.value / totalOut) * rAvail, 1) : 1;
    const n = { ...d, y: rY, h };
    rY += h + (i < outflows.length - 1 ? rGap : 0);
    return n;
  });

  // Ribbons — left fills hub from top down, right also from hub top down
  let hubAccTop = startY;
  const leftRibbons = lNodes.map(n => {
    const y0 = n.y, y1 = hubAccTop;
    hubAccTop += n.h;
    const cx = (leftX + midX) / 2;
    return `M${leftX + nodeW} ${y0} C${cx} ${y0},${cx} ${y1},${midX} ${y1} L${midX} ${y1 + n.h} C${cx} ${y1 + n.h},${cx} ${y0 + n.h},${leftX + nodeW} ${y0 + n.h} Z`;
  });

  let hubAccBot = startY;
  const rightRibbons = rNodes.map(n => {
    const y0 = hubAccBot, y1 = n.y;
    hubAccBot += n.h;
    const cx = (midX2 + rightX) / 2;
    return { path: `M${midX2} ${y0} C${cx} ${y0},${cx} ${y1},${rightX - nodeW} ${y1} L${rightX - nodeW} ${y1 + n.h} C${cx} ${y1 + n.h},${cx} ${y0 + n.h},${midX2} ${y0 + n.h} Z`, color: n.color };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {leftRibbons.map((p, i) => <path key={'l' + i} d={p} fill="var(--accent)" opacity={0.3} />)}
      {rightRibbons.map((r, i) => <path key={'r' + i} d={r.path} fill={r.color} opacity={0.38} />)}

      {/* Left hub rail */}
      <rect x={midX} y={startY} width={nodeW} height={hubH} rx={2} fill="oklch(30% 0.015 260)" />
      {/* Right hub rail */}
      <rect x={midX2 - nodeW} y={startY} width={nodeW} height={hubH} rx={2} fill="oklch(30% 0.015 260)" />

      {lNodes.map((n, i) => {
        const midY = n.y + n.h / 2;
        return (
          <g key={'ln' + i}>
            <rect x={leftX} y={n.y} width={nodeW} height={n.h} rx={2} fill="var(--accent)" />
            {n.h >= 12 && <>
              <text x={leftX - 10} y={midY + (n.h < 22 ? 3 : -1)} fontSize="10" fill="var(--ink-2)" textAnchor="end" fontWeight="500">{truncate(n.label)}</text>
              {n.h >= 22 && <text x={leftX - 10} y={midY + 11} fontSize="9" fill="var(--ink-mute)" textAnchor="end" fontFamily="var(--mono)">{fmtAxis(n.value)}</text>}
            </>}
          </g>
        );
      })}

      {rNodes.map((n, i) => {
        const midY = n.y + n.h / 2;
        return (
          <g key={'rn' + i}>
            <rect x={rightX - nodeW} y={n.y} width={nodeW} height={n.h} rx={2} fill={n.color} />
            {n.h >= 10 && <>
              <text x={rightX + 10} y={midY + (n.h < 22 ? 3 : -1)} fontSize="10" fill="var(--ink-2)" fontWeight="500">{truncate(n.label)}</text>
              {n.h >= 22 && <text x={rightX + 10} y={midY + 11} fontSize="9" fill="var(--ink-mute)" fontFamily="var(--mono)">{fmtAxis(n.value)}</text>}
            </>}
          </g>
        );
      })}
    </svg>
  );
};

export const ProgressRing: FC<{ pct: number; size?: number; thickness?: number; color?: string; label?: string }> = ({
  pct, size = 56, thickness = 5, color = 'var(--accent)', label,
}) => {
  const r = size / 2 - thickness / 2 - 1;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(pct, 1);
  const over = pct > 1;
  const fill = over ? 'var(--danger)' : color;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(50% 0.01 260 / 0.1)" strokeWidth={thickness} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fill} strokeWidth={thickness}
          strokeDasharray={`${clamped * circ} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 500, color: over ? 'var(--danger)' : 'var(--ink-2)' }}>
          {label}
        </div>
      )}
    </div>
  );
};
