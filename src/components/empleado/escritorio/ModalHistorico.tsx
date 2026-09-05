import { ModalCentrado } from '../compartido/ModalCentrado';
import { ListaConUsar } from '../compartido/ListaConUsar';
import type { EmpleadoCtx } from '../types';

interface Props {
  ctx: EmpleadoCtx;
  abierto: boolean;
  onCerrar: () => void;
}

export function ModalHistorico({ ctx, abierto, onCerrar }: Props) {
  const dias = ctx.dias
    .filter((d) => (ctx.porDia[d.fecha] ?? []).length > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .map((d) => ({ fecha: d.fecha, dow: d.dow, lineas: ctx.porDia[d.fecha] ?? [] }));

  return (
    <ModalCentrado abierto={abierto} onCerrar={onCerrar} titulo="Imputaciones anteriores" ancho="min(560px,94vw)">
      {dias.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Todavía no hay imputaciones.</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <ListaConUsar
            dias={dias}
            onUsar={(l) => {
              ctx.usarLinea(l, ctx.selDay);
              onCerrar();
            }}
          />
        </div>
      )}
    </ModalCentrado>
  );
}
