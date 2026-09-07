import { fmt } from '@/lib/horas/calendario';

export interface SegmentoDonut {
  etiqueta: string;
  valor: number;
  color: string;
}

/** Réplica de .donut/.leg del mock: conic-gradient + leyenda, sin librería de gráficos. */
export function Donut({ segmentos, total }: { segmentos: SegmentoDonut[]; total: number }) {
  if (total <= 0) return <p className="text-sm text-ink-tertiary">Sin horas registradas en el periodo.</p>;

  let acumulado = 0;
  const paradas = segmentos.map((s) => {
    const desde = (acumulado / total) * 100;
    acumulado += s.valor;
    const hasta = (acumulado / total) * 100;
    return `${s.color} ${desde}% ${hasta}%`;
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div
        className="relative h-[150px] w-[150px] shrink-0 rounded-full after:absolute after:inset-[24%] after:rounded-full after:bg-surface"
        style={{ background: `conic-gradient(${paradas.join(', ')})` }}
        role="img"
        aria-label="Reparto de horas"
      />
      <ul className="space-y-1 text-xs font-bold">
        {segmentos.map((s) => (
          <li key={s.etiqueta} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            {s.etiqueta}
            <span className="mono ml-auto pl-3 text-[11.5px] text-ink-secondary">
              {fmt(s.valor)} h · {Math.round((s.valor / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
