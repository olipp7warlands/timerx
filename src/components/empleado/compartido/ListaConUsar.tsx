import { CatDot } from './CatDot';
import { fmt, nombreDia, sumaHoras } from '@/lib/horas/calendario';
import type { ImputacionLinea } from '@/hooks/useImputacionesMes';

interface DiaConLineas {
  fecha: string;
  dow: number;
  lineas: ImputacionLinea[];
}

/** Días agrupados con "Usar" por LÍNEA suelta — distinto de FilaDia (que reutiliza el día entero). Usado en "Últimas imputaciones" (Imputar) y en el histórico completo. */
export function ListaConUsar({ dias, onUsar }: { dias: DiaConLineas[]; onUsar: (linea: ImputacionLinea) => void }) {
  return (
    <div className="space-y-3">
      {dias.map((d) => (
        <div key={d.fecha}>
          <p className="micro mb-1">
            {nombreDia(d.dow)} {Number(d.fecha.slice(-2))} · <span className="mono">{fmt(sumaHoras(d.lineas))} h</span>
          </p>
          {d.lineas.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-b-0">
              <span className="flex min-w-0 items-center gap-2">
                <CatDot categoria={l.categoriaNombre} />
                <span className="truncate">
                  {l.proyectoNombre} · {l.subcategoriaNombre}
                </span>
                <span className="mono shrink-0 text-ink-tertiary">{fmt(l.horas)} h</span>
              </span>
              <button type="button" className="btn btn-sm shrink-0" onClick={() => onUsar(l)}>
                Usar
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
