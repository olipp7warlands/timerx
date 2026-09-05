import { CalendarGrid } from '../compartido/CalendarGrid';
import { estadoDia, sumaHoras, rangoDias } from '@/lib/horas/calendario';
import type { EmpleadoCtx } from '../types';

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

const ETIQUETA_TIPO: Record<string, string> = {
  vacaciones: 'Vacaciones',
  baja_medica: 'Baja médica',
  otro_permiso: 'Otro permiso',
};

export function CalendarioMovil({ ctx }: { ctx: EmpleadoCtx }) {
  const jornada = ctx.balance?.jornadaHoras ?? 0;

  return (
    <div className="space-y-4 pt-2">
      <div className="card p-3">
        <CalendarGrid
          dias={ctx.dias}
          estadoDia={(d) => estadoDia(d.fecha, d.laborable, sumaHoras(ctx.porDia[d.fecha] ?? []), jornada, ctx.fechaHoy)}
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
        <h2 className="mb-2 text-sm font-extrabold">Mis ausencias</h2>
        {ctx.ausencias.length === 0 ? (
          <div className="card p-4 text-sm text-ink-tertiary">Sin ausencias solicitadas.</div>
        ) : (
          <div className="card divide-y divide-border px-4">
            {ctx.ausencias.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  <b>{ETIQUETA_TIPO[a.tipo] ?? a.tipo}</b>
                  <span className="micro block">{rangoDias(a.fechaInicio, a.fechaFin)}</span>
                </span>
                <span className="micro">{ETIQUETA_ESTADO[a.estado] ?? a.estado}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
