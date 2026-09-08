import { CalendarGrid } from '../compartido/CalendarGrid';
import { ausenciaEnFecha, CLASE_AUSENCIA_DIA, ETIQUETA_ESTADO_AUSENCIA, ETIQUETA_TIPO_AUSENCIA, estadoDia, sumaHoras, rangoDias } from '@/lib/horas/calendario';
import { IconAvion } from '@/components/ui/icons';
import type { EmpleadoCtx } from '../types';

export function CalendarioMovil({ ctx }: { ctx: EmpleadoCtx }) {
  const jornada = ctx.balance?.jornadaHoras ?? 0;

  return (
    <div className="space-y-4 pt-2">
      <div className="card p-3">
        <CalendarGrid
          dias={ctx.dias}
          estadoDia={(d) => estadoDia(d.fecha, d.laborable, sumaHoras(ctx.porDia[d.fecha] ?? []), jornada, ctx.fechaHoy)}
          claseExtra={(d) => (ausenciaEnFecha(d.fecha, ctx.ausencias) ? CLASE_AUSENCIA_DIA : '')}
          onClickDia={(fecha) => {
            ctx.setSelDay(fecha);
            ctx.setTab('imputar');
          }}
        />
        <div className="mt-3 flex gap-4 text-xs text-ink-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-ink-primary" /> Completo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full border border-ink-primary" /> Por completar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-ink-disabled" /> Futuro
          </span>
        </div>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <IconAvion />
          Mis ausencias
        </h2>
        {ctx.ausencias.length === 0 ? (
          <div className="card p-4 text-sm text-ink-tertiary">Sin ausencias solicitadas.</div>
        ) : (
          <div className="card divide-y divide-border px-4">
            {ctx.ausencias.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  <b>{ETIQUETA_TIPO_AUSENCIA[a.tipo] ?? a.tipo}</b>
                  <span className="micro block">{rangoDias(a.fechaInicio, a.fechaFin)}</span>
                </span>
                <span className="micro">{ETIQUETA_ESTADO_AUSENCIA[a.estado] ?? a.estado}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
