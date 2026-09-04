import { CatDot } from './CatDot';
import { fmt, nombreDia } from '@/lib/horas/calendario';
import type { ImputacionLinea } from '@/hooks/useImputacionesMes';

interface FilaDiaProps {
  fecha: string;
  dow: number;
  lineas: ImputacionLinea[];
  accion?: { texto: string; onClick: () => void };
}

/** fecha+total | líneas | slot de acción — mismo módulo que "Últimos días imputados" (Inicio) y "Anteriores imputaciones" (Imputar) en ambos mocks. */
export function FilaDia({ fecha, dow, lineas, accion }: FilaDiaProps) {
  const total = lineas.reduce((s, l) => s + l.horas, 0);
  const dia = Number(fecha.slice(-2));

  return (
    <div className="dia-row flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between">
        <b className="text-sm">
          {nombreDia(dow)} {dia}
        </b>
        <span className="mono text-sm">{fmt(total)} h</span>
      </div>
      <div className="flex flex-col gap-1">
        {lineas.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-xs text-ink-secondary">
            <span className="flex items-center gap-2">
              <CatDot categoria={l.categoriaNombre} />
              {l.proyectoNombre} · {l.subcategoriaNombre}
            </span>
            <span className="mono">{fmt(l.horas)} h</span>
          </div>
        ))}
      </div>
      {accion && (
        <button type="button" className="btn btn-sm self-start" onClick={accion.onClick}>
          {accion.texto}
        </button>
      )}
    </div>
  );
}
