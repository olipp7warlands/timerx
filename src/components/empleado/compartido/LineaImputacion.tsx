import { CatDot } from './CatDot';
import { Stepper } from './Stepper';
import { fmt } from '@/lib/horas/calendario';
import type { ImputacionLinea } from '@/hooks/useImputacionesMes';

const ESTADO_ETIQUETA: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
};

interface LineaImputacionProps {
  linea: ImputacionLinea;
  maxHorasDia: number | null;
  onAjustar: (horas: number) => void;
  onEliminar: () => void;
}

/** Editable (stepper+✕) solo si borrador/rechazada — el resto son inmutables para el empleado (RLS lo impone; aquí solo reflejamos ese estado en la UI). */
export function LineaImputacion({ linea, maxHorasDia, onAjustar, onEliminar }: LineaImputacionProps) {
  const editable = linea.estado === 'borrador' || linea.estado === 'rechazada';

  return (
    <div className="border-b border-border py-2.5 last:border-b-0">
      <div className="line-row flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <CatDot categoria={linea.categoriaNombre} />
          <span className="truncate">
            {linea.proyectoNombre} · {linea.subcategoriaNombre}
          </span>
        </span>
        {editable ? (
          <span className="flex shrink-0 items-center gap-2">
            <Stepper value={linea.horas} max={maxHorasDia ?? 12} onChange={onAjustar} />
            <button type="button" className="btn btn-sm" onClick={onEliminar} aria-label="Eliminar línea">
              ✕
            </button>
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-2 text-xs text-ink-tertiary">
            <span className="mono">{fmt(linea.horas)} h</span>
            <span>{ESTADO_ETIQUETA[linea.estado] ?? linea.estado}</span>
          </span>
        )}
      </div>
      {linea.estado === 'rechazada' && linea.motivoRechazo && <p className="micro mt-1">Rechazada: {linea.motivoRechazo}</p>}
    </div>
  );
}
