export function ProgressBar({ horas, requeridas }: { horas: number; requeridas: number }) {
  const pct = requeridas > 0 ? Math.min(100, (horas / requeridas) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-subtle">
      <div className="h-full rounded-full bg-ink-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
