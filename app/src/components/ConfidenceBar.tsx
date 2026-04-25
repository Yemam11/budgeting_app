interface Props {
  confidence: number;
}

export function ConfidenceBar({ confidence }: Props) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2 w-20">
      <div className="h-1.5 flex-1 rounded bg-slate-200 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-9 tabular-nums text-right">{pct}%</span>
    </div>
  );
}
