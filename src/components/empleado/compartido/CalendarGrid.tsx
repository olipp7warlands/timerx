import type { DiaMes } from '@/lib/horas/calendario';
import type { EstadoDia } from '@/lib/horas/calendario';

const DOT_CLASE: Record<EstadoDia, string> = {
  completo: 'bg-ink-primary',
  incompleto: 'border border-ink-primary bg-transparent',
  futuro: 'bg-ink-disabled',
  'no-laborable': 'hidden',
};

interface CalendarGridProps {
  dias: DiaMes[];
  estadoDia: (dia: DiaMes) => EstadoDia;
  claseExtra?: (dia: DiaMes) => string;
  /** Deshabilita el día además de `!dia.laborable` (p.ej. proyecto no vigente ese día). */
  deshabilitadoExtra?: (dia: DiaMes) => boolean;
  onClickDia: (fecha: string) => void;
}

/**
 * Grid de calendario puramente presentacional (réplica de pintaCal/pintaCalEn de los mocks).
 * El significado de "modo" (elegir 1 día / marcar varios / rango de 2 toques) vive en quien lo
 * consume, vía `estadoDia`/`claseExtra`/`onClickDia` — este componente solo pinta y delega clics.
 */
export function CalendarGrid({ dias, estadoDia, claseExtra, deshabilitadoExtra, onClickDia }: CalendarGridProps) {
  const offset = dias[0]?.dow ?? 0;

  return (
    <div className="grid grid-cols-7 gap-1">
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((wd) => (
        <div key={wd} className="micro text-center">
          {wd}
        </div>
      ))}
      {Array.from({ length: (offset + 6) % 7 }).map((_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {dias.map((dia) => {
        const estado = estadoDia(dia);
        return (
          <button
            key={dia.fecha}
            type="button"
            disabled={!dia.laborable || (deshabilitadoExtra?.(dia) ?? false)}
            onClick={() => onClickDia(dia.fecha)}
            className={`card flex aspect-square flex-col items-center justify-center gap-0.5 text-xs font-extrabold disabled:opacity-40 ${claseExtra?.(dia) ?? ''}`}
          >
            {Number(dia.fecha.slice(-2))}
            <span className={`h-[5px] w-[5px] rounded-full ${DOT_CLASE[estado]}`} />
          </button>
        );
      })}
    </div>
  );
}
