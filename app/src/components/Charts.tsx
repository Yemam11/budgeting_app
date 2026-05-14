import { useState, useEffect } from 'react';
import type { FC } from 'react';

const fmtAxis = (v: number) => {
  if (v === 0) return '$0';
  if (v >= 10000) return `$${Math.round(v / 1000)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
};

const fmtTip = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`;

const tipStyle: React.CSSProperties = {
  position: 'fixed', zIndex: 9999, pointerEvents: 'none',
  background: 'color-mix(in oklab, white 94%, transparent)',
  backdropFilter: 'blur(10px)',
  border: '1px solid oklch(50% 0.01 260 / 0.15)',
  borderRadius: 10, padding: '10px 14px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  fontSize: 12,
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
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
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
        const iTop = pad.t + ih - iH;
        const sTop = pad.t + ih - sH;
        return (
          <g key={i}>
            <rect x={x} y={iTop} width={bw * 0.45} height={iH} rx={3} fill="var(--accent)" opacity={0.95} />
            <rect x={x + bw * 0.5} y={sTop} width={bw * 0.45} height={sH} rx={3} fill="oklch(35% 0.015 260)" opacity={0.85} />
            {iH > 14 && <text x={x + bw * 0.225} y={iTop - 3} fontSize="7.5" fill="var(--accent)" textAnchor="middle" fontFamily="var(--mono)" opacity={0.9}>{fmtAxis(d.income)}</text>}
            {sH > 14 && <text x={x + bw * 0.725} y={sTop - 3} fontSize="7.5" fill="oklch(55% 0.01 260)" textAnchor="middle" fontFamily="var(--mono)" opacity={0.9}>{fmtAxis(d.spend)}</text>}
            <text x={x + bw / 2} y={H - 8} fontSize="10" fill={lbl} textAnchor="middle" fontFamily="var(--sans)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

type DonutDatum = { label: string; value: number; color: string };

export const Donut: FC<{ data: DonutDatum[]; size?: number; thickness?: number }> = ({ data, size = 200, thickness = 24 }) => {
  const [tip, setTip] = useState<{ x: number; y: number; item: DonutDatum; pct: number } | null>(null);
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
    return { d, path: `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`, pct: frac };
  });
  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="oklch(50% 0.01 260 / 0.08)" strokeWidth={thickness} />
        {segs.map((s, i) => (
          <path
            key={i} d={s.path} fill="none" stroke={s.d.color}
            strokeWidth={tip?.item === s.d ? thickness + 5 : thickness}
            strokeLinecap="butt"
            style={{ cursor: 'default', transition: 'stroke-width 0.1s' }}
            onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, item: s.d, pct: s.pct })}
            onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      {tip && (
        <div style={{ ...tipStyle, left: tip.x + 14, top: tip.y - 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: tip.item.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{tip.item.label}</span>
          </div>
          <div style={{ color: 'var(--ink-mute)', fontSize: 11 }}>
            {fmtTip(tip.item.value)} · {(tip.pct * 100).toFixed(1)}% of spend
          </div>
        </div>
      )}
    </>
  );
};

type StackedMonth = { label: string; values: Record<string, number> };
type StackedCat = { id: string; name: string; color: string };

export const StackedBars: FC<{ months: StackedMonth[]; categories: StackedCat[]; height?: number }> = ({ months, categories, height = 200 }) => {
  const [tip, setTip] = useState<{ x: number; y: number; m: StackedMonth; total: number } | null>(null);
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
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
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
          const rects: JSX.Element[] = [];
          for (const cat of categories) {
            const v = m.values[cat.id] ?? 0;
            if (v <= 0) continue;
            const h = (v / max) * ih;
            rects.push(<rect key={cat.id} x={x} y={barY - h} width={bw} height={Math.max(h - 1, 0)} fill={cat.color} opacity={0.88} />);
            barY -= h;
          }
          return (
            <g key={i} style={{ cursor: 'default' }}
              onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, m, total: totals[i] })}
              onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={() => setTip(null)}
            >
              {rects}
              {/* transparent hit area covers the full column */}
              <rect x={x} y={pad.t} width={bw} height={ih} fill="transparent" />
              <text x={x + bw / 2} y={H - 8} fontSize="10" fill={lbl} textAnchor="middle">{m.label}</text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div style={{ ...tipStyle, left: tip.x + 14, top: tip.y - 12, minWidth: 170 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {tip.m.label} · {fmtTip(tip.total)}
          </div>
          {categories
            .filter(c => (tip.m.values[c.id] ?? 0) > 0)
            .sort((a, b) => (tip.m.values[b.id] ?? 0) - (tip.m.values[a.id] ?? 0))
            .map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 11 }}>{fmtTip(tip.m.values[c.id] ?? 0)}</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
};

type SankeyInflow = { label: string; value: number };
type SankeyOutflow = { label: string; value: number; color: string };

const truncate = (s: string, max = 20) => s.length > max ? s.slice(0, max - 1) + '…' : s;

export const Sankey: FC<{ income: SankeyInflow[]; outflows: SankeyOutflow[]; height?: number; expanded?: boolean }> = ({ income, outflows, height = 260, expanded = false }) => {
  const totalIn  = income.reduce((s, d) => s + d.value, 0);
  const totalOut = outflows.reduce((s, d) => s + d.value, 0);

  // Track viewport width so W re-computes on resize
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1400));
  useEffect(() => {
    const handle = () => setVw(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  if (totalIn < 1 && totalOut < 1) {
    return (
      <div style={{ height: expanded ? '90vh' : height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
        No data for this period
      </div>
    );
  }

  const PAD_T = 12, PAD_B = 16;
  const MIN_OUT_H = 36;
  const GAP = 6;

  // Hub height: driven by height prop but at least tall enough for all outflow labels
  const outMinH = outflows.length * MIN_OUT_H + Math.max(outflows.length - 1, 0) * GAP;
  const IDEAL_HUB_H = Math.max(height - PAD_T - PAD_B, outMinH, 60);
  const scale = totalIn > 0 ? IDEAL_HUB_H / totalIn : 1;
  const hubH  = totalIn * scale;

  // Compute outflow node heights so we can center the income/hub vertically
  const outHeights = outflows.map(d =>
    Math.max(totalOut > 0 ? (d.value / totalOut) * hubH : MIN_OUT_H, MIN_OUT_H)
  );
  const outColH = outHeights.reduce((s, h) => s + h, 0) + Math.max(outflows.length - 1, 0) * GAP;

  // Center income bar in the outflow column; outflows start from PAD_T so they extend above & below
  const incStartY = PAD_T + Math.max(0, (outColH - hubH) / 2);
  const hubY = incStartY;

  let incY = incStartY;
  const incNodes = income.map((d, i) => {
    const h = d.value * scale;
    const n = { ...d, y: incY, h };
    incY += h + (i < income.length - 1 ? GAP : 0);
    return n;
  });

  let outY = PAD_T;
  const outNodes = outflows.map((d, i) => {
    const h = outHeights[i];
    const n = { ...d, y: outY, h };
    outY += h + (i < outflows.length - 1 ? GAP : 0);
    return n;
  });

  const lastIncY = incNodes.length ? incNodes[incNodes.length - 1].y + incNodes[incNodes.length - 1].h : incStartY;
  const lastOutY = outNodes.length ? outNodes[outNodes.length - 1].y + outNodes[outNodes.length - 1].h : PAD_T;
  const H = Math.max(hubY + hubH, lastIncY, lastOutY) + PAD_B;

  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  // Expanded: viewBox fills the 90vh overlay. Card: W ≈ card rendered width so viewBox maps 1:1 with no letterboxing.
  const W = expanded
    ? Math.max(Math.ceil(H * (vw * 0.97) / (vh * 0.9)), H)
    : Math.max(vw - 100, Math.ceil(H * 1.5));

  // Column positions as fixed proportions of W
  const INC_X  = Math.round(W * 0.235);
  const HUB_X  = Math.round(W * 0.480);
  const OUT_X  = Math.round(W * 0.725);
  const NODE_W = Math.max(8, Math.round(W * 0.009));

  // Left ribbons: income nodes → hub (gaps compress away at the hub side)
  let hubAccL = hubY;
  const leftRibbons = incNodes.map(n => {
    const y0 = n.y, y0b = n.y + n.h, y1 = hubAccL, y1b = hubAccL + n.h;
    hubAccL += n.h;
    const cx = (INC_X + NODE_W + HUB_X) / 2;
    return `M${INC_X + NODE_W} ${y0} C${cx} ${y0},${cx} ${y1},${HUB_X} ${y1} L${HUB_X} ${y1b} C${cx} ${y1b},${cx} ${y0b},${INC_X + NODE_W} ${y0b} Z`;
  });

  // Right ribbons: hub slice (proportional to value) → outflow node (full node height)
  let hubAccR = hubY;
  const rightRibbons = outNodes.map(n => {
    const sliceH = totalOut > 0 ? (n.value / totalOut) * hubH : 0;
    const y0 = hubAccR, y0b = y0 + sliceH, y1 = n.y, y1b = n.y + n.h;
    hubAccR += sliceH;
    const cx = (HUB_X + NODE_W + OUT_X) / 2;
    return {
      path: `M${HUB_X + NODE_W} ${y0} C${cx} ${y0},${cx} ${y1},${OUT_X} ${y1} L${OUT_X} ${y1b} C${cx} ${y1b},${cx} ${y0b},${HUB_X + NODE_W} ${y0b} Z`,
      color: n.color,
    };
  });

  const svgBody = (
    <>
      {leftRibbons.map((p, i) => (
        <path key={'l' + i} d={p} fill="var(--accent)" opacity={0.4} />
      ))}
      {rightRibbons.map((r, i) => (
        <path key={'r' + i} d={r.path} fill={r.color} opacity={0.55} />
      ))}

      <rect x={HUB_X} y={hubY} width={NODE_W} height={hubH} rx={2} fill="oklch(25% 0.015 260)" />

      {incNodes.map((n, i) => {
        const cy = n.y + n.h / 2;
        return (
          <g key={'in' + i}>
            <rect x={INC_X} y={n.y} width={NODE_W} height={n.h} rx={2} fill="var(--accent)" />
            {n.h >= 16 && (
              <>
                <text x={INC_X - 12} y={cy - 4} textAnchor="end" fontSize="16" fontWeight="600" fill="var(--ink-2)">{n.label}</text>
                <text x={INC_X - 12} y={cy + 14} textAnchor="end" fontSize="13" fill="var(--ink-mute)" fontFamily="var(--mono)">{fmtAxis(n.value)}</text>
              </>
            )}
          </g>
        );
      })}

      {outNodes.map((n, i) => {
        const cy = n.y + n.h / 2;
        const twoLine = n.h >= 52;
        return (
          <g key={'out' + i}>
            <rect x={OUT_X} y={n.y} width={NODE_W} height={n.h} rx={2} fill={n.color} />
            {twoLine ? (
              <>
                <text x={OUT_X + NODE_W + 12} y={cy - 4} fontSize="16" fontWeight="600" fill="var(--ink-2)">{truncate(n.label, 22)}</text>
                <text x={OUT_X + NODE_W + 12} y={cy + 14} fontSize="13" fill="var(--ink-mute)" fontFamily="var(--mono)">{fmtAxis(n.value)}</text>
              </>
            ) : (
              <text x={OUT_X + NODE_W + 12} y={cy + 5} fontSize="14" fill="var(--ink-2)">
                <tspan fontWeight="600">{truncate(n.label, 18)}</tspan>
                <tspan fill="var(--ink-mute)" fontFamily="var(--mono)" fontSize="12"> — {fmtAxis(n.value)}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </>
  );

  if (expanded) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="90vh" style={{ display: 'block' }}>
        {svgBody}
      </svg>
    );
  }

  // Padding-bottom trick: forces the div to exactly H/W aspect ratio,
  // so the SVG fills it without any letterboxing or dead space.
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W * 100).toFixed(2)}%` }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}
      >
        {svgBody}
      </svg>
    </div>
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
