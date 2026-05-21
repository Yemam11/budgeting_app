import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '../hooks/useQuery';
import { db } from '../db';
import { fmtCAD, fmtCompact, currentMonthKey, txsInMonth } from '../lib/money';
import { Icon } from '../components/Primitives';
import type { SavingsGoal } from '../types';

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthLabel = (k: string) => `${MONTH_FULL[parseInt(k.slice(5, 7), 10) - 1]} ${k.slice(0, 4)}`;

const SI_GOALS_DEFAULT: SavingsGoal[] = [
  { id: 'sg1', name: 'House Down Payment', target: 50000, pct: 50, color: 'oklch(58% 0.18 250)' },
  { id: 'sg2', name: 'New Car',            target: 20000, pct: 30, color: 'oklch(62% 0.16 155)' },
  { id: 'sg3', name: 'Emergency Fund',     target: 15000, pct: 20, color: 'oklch(66% 0.15 45)'  },
];


const GOAL_EXTRA_COLORS = [
  'oklch(62% 0.17 300)',
  'oklch(65% 0.15 20)',
  'oklch(60% 0.16 190)',
  'oklch(68% 0.13 90)',
];

// Ã¢â€â‚¬Ã¢â€â‚¬ PartitionSlider Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Shows only ACTIVE (unlocked) goals Ã¢â‚¬â€ always fills 100% of bar.
// `balance` = freeBalance from parent; when 0, shows % instead of dollars.
function PartitionSlider({ goals, balance, onGoalsChange }: {
  goals: SavingsGoal[];
  balance: number;
  onGoalsChange: (gs: SavingsGoal[]) => void;
}) {
  const barRef   = useRef<HTMLDivElement>(null);
  const goalsRef = useRef(goals);
  const cbRef    = useRef(onGoalsChange);
  goalsRef.current = goals;
  cbRef.current    = onGoalsChange;

  const [dragging, setDragging] = useState<number | null>(null);

  const active    = goals.filter(g => !g.locked);
  const pctSum    = active.reduce((s, g) => s + g.pct, 0);
  const remainder = Math.max(0, 100 - pctSum);

  useEffect(() => {
    if (dragging === null) return;
    const onMove = (e: MouseEvent) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect   = bar.getBoundingClientRect();
      const rawPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const gs     = goalsRef.current;
      const ul     = gs.filter(g => !g.locked);
      if (dragging >= ul.length - 1) return;
      const leftCum  = ul.slice(0, dragging).reduce((s, g) => s + g.pct, 0);
      const rightCum = leftCum + ul[dragging].pct + ul[dragging + 1].pct;
      const clamped  = Math.max(leftCum, Math.min(rightCum, rawPct));
      cbRef.current(gs.map(g => {
        if (g.id === ul[dragging].id)     return { ...g, pct: clamped - leftCum };
        if (g.id === ul[dragging + 1].id) return { ...g, pct: rightCum - clamped };
        return g;
      }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragging]);

  if (active.length === 0) return null;

  return (
    <div ref={barRef} style={{
      position: 'relative', height: 60, borderRadius: 15,
      userSelect: 'none', cursor: dragging !== null ? 'col-resize' : 'default',
      background: 'color-mix(in oklab, white 62%, transparent)',
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid rgba(255,255,255,0.78)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 20px rgba(0,0,0,0.04)',
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', display: 'flex' }}>
        {active.map(g => (
          <div key={g.id} style={{
            width: g.pct + '%', height: '100%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            transition: dragging !== null ? 'none' : 'width 0.22s ease',
            background: `linear-gradient(180deg, color-mix(in oklab, ${g.color}, white 44%) 0%, color-mix(in oklab, ${g.color}, white 14%) 100%)`,
            opacity: 0.55,
            borderRight: '1px solid rgba(255,255,255,0.38)',
          }}>
            {g.pct > 8 && (
              <div style={{ textAlign: 'center', padding: '0 8px', pointerEvents: 'none', userSelect: 'none',
                color: `color-mix(in oklab, ${g.color}, black 42%)`, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>
                  {balance > 0 ? fmtCompact((g.pct / 100) * balance) : `${Math.round(g.pct)}%`}
                </div>
              </div>
            )}
          </div>
        ))}
        {remainder > 0.5 && (
          <div style={{
            width: remainder + '%', height: '100%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            transition: dragging !== null ? 'none' : 'width 0.22s ease',
            background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 4px, transparent 4px, transparent 8px)',
            opacity: 0.7,
          }}>
            {remainder > 10 && (
              <div style={{ textAlign: 'center', padding: '0 8px', pointerEvents: 'none', userSelect: 'none',
                color: 'var(--ink-mute)', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Unallocated
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>
                  {balance > 0 ? fmtCompact((remainder / 100) * balance) : `${Math.round(remainder)}%`}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {active.slice(0, -1).map((_, i) => {
        const left = active.slice(0, i + 1).reduce((s, g) => s + g.pct, 0);
        const handleColor = `color-mix(in oklab, ${active[i].color} 50%, ${active[i + 1].color} 50%)`;
        return (
          <div key={i}
            onMouseDown={e => { e.preventDefault(); setDragging(i); }}
            style={{ position: 'absolute', top: -6, bottom: -6, left: left + '%', width: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
            <div style={{ width: 16, height: '100%', cursor: 'col-resize',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateX(-50%)' }}>
              <div style={{
                width: 5, height: '100%', borderRadius: 3,
                background: handleColor,
                boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.14)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ GoalCard Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function GoalCard({ goal, freeBalance, onRename, onRetarget, onReallocate, onRemove, onToggleLock }: {
  goal: SavingsGoal;
  freeBalance: number;
  onRename: (name: string) => void;
  onRetarget: (target: number) => void;
  onReallocate: (newAmount: number) => void;
  onRemove: () => void;
  onToggleLock: () => void;
}) {
  const allocated = goal.locked ? (goal.lockedValue ?? 0) : Math.max(0, (goal.pct / 100) * freeBalance);
  const progress  = goal.target > 0 ? Math.min(1, allocated / goal.target) : 0;
  const [editName,    setEditName]    = useState(false);
  const [nameDraft,   setNameDraft]   = useState(goal.name);
  const [editTarget,  setEditTarget]  = useState(false);
  const [tgtDraft,    setTgtDraft]    = useState(String(goal.target));
  const [editAlloc,   setEditAlloc]   = useState(false);
  const [allocDraft,  setAllocDraft]  = useState('');

  return (
    <div className="glass" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: goal.color, flexShrink: 0,
            boxShadow: `0 0 0 3px color-mix(in oklab, ${goal.color}, transparent 78%)` }} />
          {editName ? (
            <input className="input" value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={() => { onRename(nameDraft); setEditName(false); }}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              autoFocus style={{ fontSize: 12, fontWeight: 500, padding: '2px 6px', flex: 1, minWidth: 0 }} />
          ) : (
            <span title="Click to rename" onClick={() => { setNameDraft(goal.name); setEditName(true); }}
              style={{ fontSize: 13, fontWeight: 500, cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {goal.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {goal.locked
            ? <span style={{ fontSize: 10, fontWeight: 600, color: goal.color,
                background: `color-mix(in oklab, ${goal.color}, transparent 88%)`,
                padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em' }}>LOCKED</span>
            : <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>{Math.round(goal.pct)}%</span>
          }
          <button onClick={onToggleLock}
            title={goal.locked ? 'Unlock Ã¢â‚¬â€ re-enter active savings pool' : 'Lock value at current amount'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
              borderRadius: 4, border: 'none', cursor: 'pointer',
              background: goal.locked ? `color-mix(in oklab, ${goal.color}, transparent 78%)` : 'none',
              color: goal.locked ? goal.color : 'var(--ink-mute)' }}>
            <Icon name={goal.locked ? 'lock' : 'unlock'} size={11} />
          </button>
          <button onClick={onRemove}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
              borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)' }}>
            <Icon name="x" size={11} />
          </button>
        </div>
      </div>

      {/* Amount */}
      <div>
        {editAlloc ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 16, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>$</span>
            <input className="input" value={allocDraft} onChange={e => setAllocDraft(e.target.value)}
              autoFocus style={{ fontSize: 18, fontFamily: 'var(--mono)', fontWeight: 500, width: 100, letterSpacing: '-0.02em' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseFloat(allocDraft.replace(/[^0-9.]/g, ''));
                  if (!isNaN(v) && v >= 0) onReallocate(v);
                  setEditAlloc(false);
                }
                if (e.key === 'Escape') setEditAlloc(false);
              }}
              onBlur={() => {
                const v = parseFloat(allocDraft.replace(/[^0-9.]/g, ''));
                if (!isNaN(v) && v >= 0) onReallocate(v);
                setEditAlloc(false);
              }} />
          </div>
        ) : (
          <div
            title={goal.locked ? 'Unlock to edit allocation' : 'Click to set amount'}
            onClick={() => { if (!goal.locked) { setAllocDraft(allocated.toFixed(2)); setEditAlloc(true); } }}
            style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.025em', fontFamily: 'var(--mono)',
              cursor: goal.locked ? 'default' : 'text', display: 'inline-block',
              opacity: goal.locked ? 0.75 : 1 }}>
            {fmtCAD(allocated)}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1, display: 'flex', gap: 3, alignItems: 'baseline', flexWrap: 'wrap' }}>
          of{' '}
          {editTarget ? (
            <input className="input" value={tgtDraft}
              onChange={e => setTgtDraft(e.target.value)}
              onBlur={() => { const v = parseFloat(tgtDraft.replace(/\D/g, '')); if (v > 0) onRetarget(v); setEditTarget(false); }}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              autoFocus style={{ fontSize: 11, padding: '1px 5px', width: 76 }} />
          ) : (
            <span onClick={() => { setTgtDraft(String(goal.target)); setEditTarget(true); }}
              style={{ cursor: 'text', textDecoration: 'underline dotted var(--line-strong)' }}>
              {fmtCompact(goal.target)}
            </span>
          )}{' '}goal
        </div>
      </div>

      {/* Progress */}
      <div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: Math.round(progress * 100) + '%', height: '100%', background: goal.color,
            borderRadius: 999, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4, fontFamily: 'var(--mono)' }}>
          {Math.round(progress * 100)}%{' '}
          {allocated < goal.target
            ? <span>Ã‚Â· {fmtCAD(goal.target - allocated)} to go</span>
            : <span style={{ color: 'oklch(50% 0.16 160)' }}>Ã‚Â· Goal reached Ã°Å¸Å½â€°</span>}
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ FlexAllocRow Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function FlexAllocRow({ color, label, sublabel, amount, accent }: {
  color: string; label: string; sublabel?: string; amount: number; accent: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--card-surface)',
      borderRadius: 10, padding: '10px 14px', border: '1px solid var(--line)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent, flexShrink: 0, fontFamily: 'var(--mono)' }}>
        +{fmtCAD(amount)}
      </span>
      <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>Apply</button>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ FlexCard Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function FlexCard({ goals, flexBalance, thisMoSurplus, currentMonth }: {
  goals: SavingsGoal[];
  flexBalance: number;
  thisMoSurplus: number;
  currentMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const savingsAlloc = Math.round(thisMoSurplus * 0.60);
  const investAlloc  = thisMoSurplus - savingsAlloc;
  const positive = flexBalance >= 0;
  const accentColor = positive ? 'oklch(55% 0.17 165)' : 'oklch(65% 0.18 25)';

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid color-mix(in oklab, ${accentColor}, var(--line) 60%)`,
      background: positive
        ? 'color-mix(in oklab, oklch(55% 0.17 165), var(--bg) 94%)'
        : 'color-mix(in oklab, oklch(65% 0.18 25), var(--bg) 94%)',
      backdropFilter: 'blur(16px)',
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `color-mix(in oklab, ${accentColor}, transparent 78%)`,
          border: `1px solid color-mix(in oklab, ${accentColor}, transparent 55%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
          <Icon name={positive ? 'arrow_up_right' : 'arrow_down_right'} size={18} />
        </div>

        {/* Balance */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>Flex Account Ã‚Â· Virtual buffer</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', color: accentColor, fontFamily: 'var(--mono)' }}>
              {positive ? '' : 'Ã¢Ë†â€™'}{fmtCAD(Math.abs(flexBalance))}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>running balance</span>
          </div>
        </div>

        {/* This-month badge + button */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 12, padding: '5px 12px', borderRadius: 9,
            background: 'var(--card-surface)', border: '1px solid var(--line)',
            whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--ink-mute)' }}>{monthLabel(currentMonth)}</span>
            <span style={{ color: accentColor, fontWeight: 600, marginLeft: 6, fontFamily: 'var(--mono)' }}>
              {thisMoSurplus >= 0 ? '+' : ''}{fmtCAD(thisMoSurplus)}
            </span>
          </div>
          {thisMoSurplus > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(o => !o)}>
              {open ? 'Close' : 'Allocate Ã¢â€ â€™'}
            </button>
          )}
        </div>
      </div>

      {/* Allocation panel */}
      {open && thisMoSurplus > 0 && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid color-mix(in oklab, ${accentColor}, transparent 72%)` }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Suggested allocation Ã¢â‚¬â€ {fmtCAD(thisMoSurplus)} surplus
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FlexAllocRow
              color="oklch(58% 0.18 250)"
              label="Savings goals"
              sublabel={goals.map(g => `${g.name.split(' ')[0]} ${Math.round(g.pct)}%`).join(' Ã‚Â· ')}
              amount={savingsAlloc}
              accent={accentColor} />
            {goals.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-soft)' }}>{g.name}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                  {fmtCAD(Math.round((g.pct / 100) * savingsAlloc))}
                </span>
              </div>
            ))}
            <FlexAllocRow
              color="oklch(56% 0.16 280)"
              label="TFSA top-up"
              sublabel={`Based on ${Math.round((investAlloc / Math.max(1, thisMoSurplus)) * 100)}% allocation`}
              amount={investAlloc}
              accent={accentColor} />
          </div>
        </div>
      )}
    </div>
  );
}


// Ã¢â€â‚¬Ã¢â€â‚¬ Section divider Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function SIDivider({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--ink-mute)' }}>
        <Icon name={icon} size={11} stroke={2} />
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Main page Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export function SavingsInvestmentsPage() {
  const txs = useQuery(() => db.transactions.toArray(), []) ?? [];

  // Persisted state Ã¢â‚¬â€ loaded from db.settings on mount
  const [goals,               setGoalsRaw]               = useState<SavingsGoal[]>(SI_GOALS_DEFAULT);
  const [savingsOverride,     setSavingsOverrideRaw]     = useState<number | null>(null);
  const [savingsOverrideBase, setSavingsOverrideBaseRaw] = useState(0);
  const [flexBalance,         setFlexBalanceRaw]         = useState(0);
  const [showFlex,            setShowFlexRaw]            = useState(true);
  const [settingsLoaded,      setSettingsLoaded]         = useState(false);

  useEffect(() => {
    Promise.all([
      db.settings.get('si_goals'),
      db.settings.get('si_savings_override'),
      db.settings.get('si_savings_override_base'),
      db.settings.get('si_flex_balance'),
      db.settings.get('si_show_flex'),
    ]).then(([g, so, sob, fb, sf]) => {
      if (g)  setGoalsRaw(g.value as SavingsGoal[]);
      setSavingsOverrideRaw(so ? (so.value as number | null) : null);
      setSavingsOverrideBaseRaw(sob ? (sob.value as number) : 0);
      if (fb) setFlexBalanceRaw(fb.value as number ?? 0);
      if (sf) setShowFlexRaw(sf.value as boolean);
      setSettingsLoaded(true);
    });
  }, []);

  function setShowFlex(next: boolean) {
    setShowFlexRaw(next);
    db.settings.put({ key: 'si_show_flex', value: next });
  }

  function setGoals(next: SavingsGoal[]) {
    setGoalsRaw(next);
    db.settings.put({ key: 'si_goals', value: next });
  }

  // All savings transactions Ã¢â‚¬â€ cumulative, no month filter
  const savingsTxsAll = useMemo(() =>
    txs.filter(t => t.type === 'savings' && !t.hidden)
       .sort((a, b) => b.date.localeCompare(a.date)),
  [txs]);

  const fromTxs = useMemo(() =>
    savingsTxsAll.reduce((s, t) => s + t.amount, 0),
  [savingsTxsAll]);

  // Delta tracking: override value + any new transactions since the override was set
  const balance = savingsOverride !== null
    ? savingsOverride + (fromTxs - savingsOverrideBase)
    : fromTxs;

  function setSavingsOverride(val: number | null) {
    setSavingsOverrideRaw(val);
    db.settings.put({ key: 'si_savings_override', value: val });
    if (val !== null) {
      setSavingsOverrideBaseRaw(fromTxs);
      db.settings.put({ key: 'si_savings_override_base', value: fromTxs });
    }
  }

  // Savings balance editing
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft,   setBalanceDraft]   = useState('');

  const saveBalance = () => {
    const v = parseFloat(balanceDraft.replace(/[^0-9.]/g, ''));
    if (!isNaN(v) && v >= 0) setSavingsOverride(v);
    setEditingBalance(false);
  };

  // Flex account surplus Ã¢â‚¬â€ always current month, not time-filtered
  const currentMonth = currentMonthKey();
  const thisMoSurplus = useMemo(() => {
    const monthTxs = txsInMonth(txs, currentMonth);
    const income = monthTxs.filter(t => t.type === 'income' && !t.hidden)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const spend = monthTxs.filter(t => t.type === 'spend' && !t.hidden)
      .reduce((s, t) => s + t.amount, 0);
    const savingsOut = monthTxs
      .filter(t => t.type === 'savings' && !t.hidden)
      .reduce((s, t) => s + t.amount, 0);
    const investOut = monthTxs
      .filter(t => t.type === 'investment' && !t.hidden)
      .reduce((s, t) => s + t.amount, 0);
    return Math.round(income - spend - savingsOut - investOut);
  }, [txs, currentMonth]);

  // Derived: freeBalance = total balance minus all locked-goal values
  const lockedTotal = goals.filter(g => g.locked).reduce((s, g) => s + (g.lockedValue ?? 0), 0);
  const freeBalance = balance - lockedTotal;

  // Goal mutations
  const updateGoal = (id: string, patch: Partial<SavingsGoal>) =>
    setGoals(goals.map(g => g.id === id ? { ...g, ...patch } : g));

  const toggleLock = (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    if (!goal.locked) {
      // Lock: freeze current dollar value, remove pct from active pool
      const frozenValue   = (goal.pct / 100) * freeBalance;
      const otherUnlocked = goals.filter(g => g.id !== id && !g.locked);
      const otherTotal    = otherUnlocked.reduce((s, g) => s + g.pct, 0);
      const lostPct       = goal.pct;
      setGoals(goals.map(g => {
        if (g.id === id) return { ...g, locked: true, lockedValue: frozenValue, pct: 0 };
        if (g.locked)    return g;
        return { ...g, pct: g.pct + (otherTotal > 0 ? (g.pct / otherTotal) * lostPct : lostPct / Math.max(1, otherUnlocked.length)) };
      }));
    } else {
      // Unlock: release value, give goal a fresh pct from the active pool
      const otherUnlocked = goals.filter(g => g.id !== id && !g.locked);
      const otherTotal    = otherUnlocked.reduce((s, g) => s + g.pct, 0);
      const newPct        = Math.min(20, Math.max(1, otherTotal * 0.2));
      const scale         = otherTotal > 0 ? (otherTotal - newPct) / otherTotal : 1;
      setGoals(goals.map(g => {
        if (g.id === id) return { ...g, locked: false, lockedValue: undefined, pct: newPct };
        if (g.locked)    return g;
        return { ...g, pct: g.pct * scale };
      }));
    }
  };

  const reallocateGoal = (id: string, newAmount: number) => {
    if (freeBalance <= 0) return;
    const newPct        = Math.min(100, Math.max(0, (newAmount / freeBalance) * 100));
    const otherUnlocked = goals.filter(g => g.id !== id && !g.locked);
    const otherTotal    = otherUnlocked.reduce((s, g) => s + g.pct, 0);
    const remaining     = Math.max(0, 100 - newPct);
    setGoals(goals.map(g =>
      g.id === id
        ? { ...g, pct: newPct }
        : g.locked
          ? g
          : { ...g, pct: otherTotal > 0 ? (g.pct / otherTotal) * remaining : remaining / Math.max(1, otherUnlocked.length) }
    ));
  };

  const removeGoal = (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const kept = goals.filter(g => g.id !== id);
    if (!kept.length) return;
    if (goal.locked) {
      setGoals(kept);
      return;
    }
    const unlocked      = kept.filter(g => !g.locked);
    const unlockedTotal = unlocked.reduce((s, g) => s + g.pct, 0);
    const lostPct       = goal.pct;
    setGoals(kept.map(g =>
      g.locked
        ? g
        : { ...g, pct: g.pct + (unlockedTotal > 0 ? (g.pct / unlockedTotal) * lostPct : lostPct / Math.max(1, unlocked.length)) }
    ));
  };

  const [showAddGoal,   setShowAddGoal]   = useState(false);
  const [newGoalName,   setNewGoalName]   = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  const addGoal = () => {
    if (!newGoalName.trim()) return;
    const target        = parseFloat(newGoalTarget.replace(/\D/g, '')) || 10000;
    const color         = GOAL_EXTRA_COLORS[goals.length % GOAL_EXTRA_COLORS.length];
    const unlockedTotal = goals.filter(g => !g.locked).reduce((s, g) => s + g.pct, 0);
    const newPct        = Math.min(20, Math.max(1, unlockedTotal * 0.2));
    const scale         = unlockedTotal > 0 ? (unlockedTotal - newPct) / unlockedTotal : 1;
    const updated       = goals.map(g => g.locked ? g : { ...g, pct: g.pct * scale });
    updated.push({ id: 'sg' + Date.now(), name: newGoalName.trim(), target, pct: newPct, color });
    setGoals(updated);
    setNewGoalName('');
    setNewGoalTarget('');
    setShowAddGoal(false);
  };

  if (!settingsLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--ink-mute)', fontSize: 13 }}>
        LoadingÃ¢â‚¬Â¦
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040 }}>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Page header Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Wealth</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Savings</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 560 }}>
              Current snapshot Ã¢â‚¬â€ partition your savings across goals Ã‚Â· surplus flows through the Flex buffer.
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 11, flexShrink: 0, marginTop: 4 }}
            onClick={() => setShowFlex(!showFlex)}>
            <Icon name={showFlex ? 'eye_off' : 'eye'} size={11} />
            {showFlex ? 'Hide' : 'Show'} Flex Account
          </button>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Flex Account Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {showFlex && <FlexCard goals={goals} flexBalance={flexBalance} thisMoSurplus={thisMoSurplus} currentMonth={currentMonth} />}


      {/* Balance + partition card */}
      <div className="glass" style={{ padding: 24 }}>
        {/* Balance row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Total balance</div>
            {editingBalance ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>$</span>
                <input className="input" value={balanceDraft}
                  onChange={e => setBalanceDraft(e.target.value)} autoFocus
                  style={{ fontSize: 26, fontFamily: 'var(--mono)', fontWeight: 500, width: 168, letterSpacing: '-0.025em' }}
                  onKeyDown={e => e.key === 'Enter' && saveBalance()} />
                <button className="btn btn-primary" onClick={saveBalance}>Save</button>
                <button className="btn btn-ghost" onClick={() => setEditingBalance(false)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 40, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--ink)', fontFamily: 'var(--mono)' }}>
                  {fmtCAD(balance)}
                </span>
                <button className="btn btn-ghost" style={{ fontSize: 11, marginBottom: 6 }}
                  onClick={() => { setBalanceDraft(String(Math.round(balance))); setEditingBalance(true); }}>
                  <Icon name="settings" size={11} />Edit
                </button>
              </div>
            )}
            {savingsOverride !== null && (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4,
                display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Icon name="sparkle" size={10} />
                Manual base {fmtCAD(savingsOverride)} + {fmtCAD(fromTxs - savingsOverrideBase)} from new transactions
                <button onClick={() => setSavingsOverride(null)}
                  style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Reset to transactions
                </button>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>From transactions</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink-soft)', fontFamily: 'var(--mono)' }}>
              {fmtCAD(fromTxs)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
              {savingsTxsAll.length} savings transfer{savingsTxsAll.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Active goals Ã¢â‚¬â€ allocation plan for new savings */}
        {(() => {
          const activeGoals = goals.filter(g => !g.locked);
          return activeGoals.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: freeBalance < 0 ? 'var(--danger)' : 'var(--ink-soft)' }}>
                  {freeBalance > 0
                    ? `Distributing ${fmtCAD(freeBalance)} Ã‚Â· drag to rebalance`
                    : freeBalance < 0
                      ? `Locked goals exceed balance by ${fmtCAD(Math.abs(freeBalance))}`
                      : 'Allocation plan Ã¢â‚¬â€ drag to set % for new savings'}
                </div>
                {freeBalance < 0 && (
                  <span style={{ fontSize: 11, color: 'var(--danger)', fontStyle: 'italic' }}>
                    Save {fmtCAD(Math.abs(freeBalance))} more or unlock a goal
                  </span>
                )}
                {freeBalance === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                    No free balance yet Ã¢â‚¬â€ percentages shown
                  </span>
                )}
              </div>
              <PartitionSlider goals={goals} balance={Math.max(0, freeBalance)} onGoalsChange={setGoals} />
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', marginTop: 16 }}>
                {activeGoals.map(g => (
                  <GoalCard key={g.id} goal={g} freeBalance={freeBalance}
                    onRename={name     => updateGoal(g.id, { name })}
                    onRetarget={target => updateGoal(g.id, { target })}
                    onReallocate={amt  => reallocateGoal(g.id, amt)}
                    onRemove={() => removeGoal(g.id)}
                    onToggleLock={() => toggleLock(g.id)} />
                ))}
                {showAddGoal ? (
                  <div className="glass" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>New goal</div>
                    <input className="input" placeholder="Goal name" value={newGoalName}
                      onChange={e => setNewGoalName(e.target.value)} style={{ fontSize: 12 }} autoFocus />
                    <input className="input" placeholder="Target (e.g. 15000)" value={newGoalTarget}
                      onChange={e => setNewGoalTarget(e.target.value)} style={{ fontSize: 12 }}
                      onKeyDown={e => e.key === 'Enter' && addGoal()} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={addGoal}>Add</button>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setShowAddGoal(false); setNewGoalName(''); setNewGoalTarget(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-ghost"
                    style={{ minHeight: 80, flexDirection: 'column', gap: 4,
                      justifyContent: 'center', borderStyle: 'dashed', fontSize: 12, padding: '10px 18px' }}
                    onClick={() => setShowAddGoal(true)}>
                    <Icon name="plus" size={14} />Add goal
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-mute)' }}>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                {goals.some(g => g.locked) ? 'All goals completed Ã¢â‚¬â€ add a new one to keep saving.' : 'No goals yet.'}
              </div>
              <button className="btn btn-primary" onClick={() => setShowAddGoal(true)}>
                <Icon name="plus" size={12} />Add goal
              </button>
              {showAddGoal && (
                <div className="glass" style={{ padding: 16, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>New goal</div>
                  <input className="input" placeholder="Goal name" value={newGoalName}
                    onChange={e => setNewGoalName(e.target.value)} style={{ fontSize: 12 }} autoFocus />
                  <input className="input" placeholder="Target (e.g. 15000)" value={newGoalTarget}
                    onChange={e => setNewGoalTarget(e.target.value)} style={{ fontSize: 12 }}
                    onKeyDown={e => e.key === 'Enter' && addGoal()} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={addGoal}>Add</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setShowAddGoal(false); setNewGoalName(''); setNewGoalTarget(''); }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Completed Goals Ã¢â‚¬â€ locked goals shown separately */}
      {goals.some(g => g.locked) && (
        <>
          <SIDivider icon="check" label="Completed Goals" />
          <div className="glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Value locked in Ã‚Â· unlock to re-enter the active savings pool
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
              {goals.filter(g => g.locked).map(g => (
                <GoalCard key={g.id} goal={g} freeBalance={freeBalance}
                  onRename={name     => updateGoal(g.id, { name })}
                  onRetarget={target => updateGoal(g.id, { target })}
                  onReallocate={amt  => reallocateGoal(g.id, amt)}
                  onRemove={() => removeGoal(g.id)}
                  onToggleLock={() => toggleLock(g.id)} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Savings history table Ã¢â‚¬â€ all time */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Savings history</div>
          <span className="chip">Auto-detected from "Savings Transfer" category Ã‚Â· all time</span>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th style={{ textAlign: 'right', width: 130 }}>Amount</th>
              <th style={{ width: 180 }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {savingsTxsAll.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-mute)', fontSize: 13 }}>
                  No savings transfers yet. Tag a transaction with the "Savings Transfer" category to get started.
                </td>
              </tr>
            ) : savingsTxsAll.map(t => (
              <tr key={t.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)' }}>{t.date}</td>
                <td style={{ fontSize: 13 }}>{t.merchantRaw}</td>
                <td style={{ textAlign: 'right', fontWeight: 500, fontFamily: 'var(--mono)', color: 'oklch(48% 0.17 165)' }}>
                  +{fmtCAD(t.amount)}
                </td>
                <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{t.notes || 'Ã¢â‚¬â€'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
