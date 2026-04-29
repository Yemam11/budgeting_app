import type { FC } from 'react';

export const Icon: FC<{ name: string; size?: number; stroke?: number }> = ({ name, size = 16, stroke = 1.5 }) => {
  const paths: Record<string, JSX.Element> = {
    dashboard: <><path d="M3 3h7v9H3z"/><path d="M14 3h7v5h-7z"/><path d="M14 12h7v9h-7z"/><path d="M3 16h7v5H3z"/></>,
    transactions: <><path d="M3 7h14M17 7l-3-3M17 7l-3 3"/><path d="M21 17H7M7 17l3 3M7 17l3-3"/></>,
    budget: <><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/></>,
    import: <><path d="M12 3v12M12 15l-4-4M12 15l4-4"/><path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></>,
    owed: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 4l3 3-3 3M20 7h-5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    filter: <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    sort: <><path d="M7 4v16M7 20l-3-3M7 20l3-3"/><path d="M17 20V4M17 4l-3 3M17 4l3 3"/></>,
    arrow_up_right: <><path d="M7 17 17 7M8 7h9v9"/></>,
    arrow_down_right: <><path d="M7 7l10 10M17 8v9H8"/></>,
    arrow_down: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    arrow_up: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    more: <><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>,
    check: <><path d="m5 12 5 5L20 7"/></>,
    x: <><path d="M6 6l12 12M18 6 6 18"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    download: <><path d="M12 3v12M12 15l-4-4M12 15l4-4"/><path d="M4 19h16"/></>,
    upload: <><path d="M12 21V9M12 9l-4 4M12 9l4 4"/><path d="M4 5h16"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></>,
    bank: <><path d="M3 9h18M5 9l7-5 7 5M5 9v9M19 9v9M9 13v3M12 13v3M15 13v3M3 21h18"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    split: <><path d="M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6"/><path d="M3 6l3-3 3 3M15 18l3 3 3-3"/></>,
    chevron_down: <><path d="m6 9 6 6 6-6"/></>,
    chevron_right: <><path d="m9 18 6-6-6-6"/></>,
    shield: <><path d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></>,
    eye_off: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
    edit: <><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>,
  };
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {paths[name] ?? null}
    </svg>
  );
};

export const BankLogo: FC<{ bank: string; size?: number }> = ({ bank, size = 22 }) => {
  const s = ({
    amex: { bg: 'oklch(48% 0.15 255)', label: 'AX' },
    bmo: { bg: 'oklch(52% 0.18 25)', label: 'BM' },
    scotia: { bg: 'oklch(55% 0.17 15)', label: 'SC' },
    simplii: { bg: 'oklch(50% 0.18 145)', label: 'SI' },
  } as Record<string, { bg: string; label: string }>)[bank] ?? { bg: 'oklch(60% 0.02 260)', label: '??' };
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: s.bg, color: 'white', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, fontFamily: 'var(--mono)',
      letterSpacing: '-0.04em',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
    }}>{s.label}</div>
  );
};

export const CatSwatch: FC<{ color: string; size?: number }> = ({ color, size = 8 }) => (
  <span style={{
    display: 'inline-block',
    width: size, height: size, borderRadius: '50%',
    background: color, flexShrink: 0,
    boxShadow: `0 0 0 3px color-mix(in oklab, ${color}, transparent 80%)`,
  }} />
);

export const Delta: FC<{ value: number; prefix?: string }> = ({ value, prefix = '' }) => {
  const up = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 12, fontWeight: 500,
      color: up ? 'oklch(55% 0.14 160)' : 'oklch(58% 0.18 25)',
      fontFamily: 'var(--mono)',
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {up ? <path d="M2 7 5 3 8 7" /> : <path d="M2 3 5 7 8 3" />}
      </svg>
      {prefix}{Math.abs(value).toFixed(1)}%
    </span>
  );
};

export const ConfBar: FC<{ c: number }> = ({ c }) => {
  const pct = Math.round(c * 100);
  const tone = c >= 0.9 ? 'oklch(70% 0.14 160)' : c >= 0.7 ? 'oklch(72% 0.14 85)' : 'oklch(62% 0.16 30)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'oklch(50% 0.01 260 / 0.12)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: tone, borderRadius: 999 }} />
      </div>
      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)', width: 26, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
};

export const Toggle: FC<{ on: boolean; onChange?: (v: boolean) => void }> = ({ on, onChange }) => (
  <div
    onClick={() => onChange?.(!on)}
    role="switch"
    aria-checked={on}
    style={{
      width: 36, height: 20, borderRadius: 999,
      background: on ? 'var(--accent)' : 'oklch(50% 0.01 260 / 0.2)',
      position: 'relative', transition: 'background .2s',
      cursor: 'pointer', flexShrink: 0,
      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)',
    }}
  >
    <div style={{
      position: 'absolute', top: 2, left: on ? 18 : 2,
      width: 16, height: 16, borderRadius: '50%',
      background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      transition: 'left .2s',
    }} />
  </div>
);
