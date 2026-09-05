import { BottomSheet } from '../compartido/BottomSheet';
import { ListaConUsar } from '../compartido/ListaConUsar';
import type { EmpleadoCtx } from '../types';

interface Props {
  ctx: EmpleadoCtx;
  abierto: boolean;
  onCerrar: () => void;
}

/** Histórico completo del mes, orden descendente — mismo componente que "Últimas imputaciones", con "Usar" por línea. */
export function HistorialSheet({ ctx, abierto, onCerrar }: Props) {
  const dias = ctx.dias
    .filter((d) => (ctx.porDia[d.fecha] ?? []).length > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .map((d) => ({ fecha: d.fecha, dow: d.dow, lineas: ctx.porDia[d.fecha] ?? [] }));

  return (
    <BottomSheet abierto={abierto} onCerrar={onCerrar} titulo="Imputaciones anteriores">
      {dias.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Todavía no hay imputaciones.</p>
      ) : (
        <ListaConUsar
          dias={dias}
          onUsar={(l) => {
            ctx.usarLinea(l, ctx.selDay);
            onCerrar();
          }}
        />
      )}
    </BottomSheet>
  );
}
