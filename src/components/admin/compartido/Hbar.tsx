import { fmt } from '@/lib/horas/calendario';

export interface FilaHbar {
  etiqueta: string;
  valor: number;
}

/** Réplica de .hbar del mock: barras horizontales simples (divs), sin librería de gráficos. */
export function Hbar({ filas }: { filas: FilaHbar[] }) {
  if (filas.length === 0) return <p className="text-sm text-ink-tertiary">Sin datos.</p>;
  const max = Math.max(...filas.map((f) => f.valor), 1);

  return (
    <div>
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-center gap-2.5 py-1.5">
          <span className="w-28 shrink-0 text-xs font-bold">{f.etiqueta}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-subtle">
            <i className="block h-full rounded-full bg-ink-primary" style={{ width: `${Math.round((f.valor / max) * 100)}%` }} />
          </span>
          <span className="mono w-16 shrink-0 text-right text-xs">{fmt(f.valor)} h</span>
        </div>
      ))}
    </div>
  );
}
