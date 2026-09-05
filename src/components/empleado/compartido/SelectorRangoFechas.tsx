import { CalendarGrid } from './CalendarGrid';
import { rangoDias } from '@/lib/horas/calendario';
import type { DiaMes } from '@/lib/horas/calendario';

export interface RangoFechas {
  inicio: string | null;
  fin: string | null;
}

interface Props {
  dias: DiaMes[];
  rango: RangoFechas;
  onChange: (rango: RangoFechas) => void;
}

/**
 * Primer toque = inicio, segundo toque = fin (pinta el rango contiguo), tercer
 * toque reinicia. Ajuste deliberado frente al selector multi-día suelto del
 * mock móvil: `solicitar_ausencia` solo acepta un rango contiguo, así que aquí
 * no se permite marcar días sueltos no consecutivos. Compartido entre el
 * wizard móvil (paso "ausdias") y el modal de escritorio.
 */
export function SelectorRangoFechas({ dias, rango, onChange }: Props) {
  function onClickDia(fecha: string) {
    if (!rango.inicio || (rango.inicio && rango.fin)) {
      onChange({ inicio: fecha, fin: null });
      return;
    }
    if (fecha < rango.inicio) onChange({ inicio: fecha, fin: rango.inicio });
    else onChange({ ...rango, fin: fecha });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-tertiary">
        Primer toque = inicio, segundo toque = fin. Seleccionado:{' '}
        {rango.inicio ? rangoDias(rango.inicio, rango.fin ?? rango.inicio) : 'ninguno'}.
      </p>
      <CalendarGrid
        dias={dias}
        estadoDia={() => 'no-laborable'}
        claseExtra={(d) => {
          if (!rango.inicio) return '';
          const fin = rango.fin ?? rango.inicio;
          return d.fecha >= rango.inicio && d.fecha <= fin ? 'bg-accent text-on-accent border-accent' : '';
        }}
        onClickDia={onClickDia}
      />
    </div>
  );
}
