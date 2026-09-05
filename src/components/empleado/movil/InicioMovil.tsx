import { ProgressBar } from '../compartido/ProgressBar';
import { FilaDia } from '../compartido/FilaDia';
import { CalendarGrid } from '../compartido/CalendarGrid';
import { fmt, estadoDia, sumaHoras } from '@/lib/horas/calendario';
import type { EmpleadoCtx } from '../types';

interface Props {
  ctx: EmpleadoCtx;
  onAbrirHistorial: () => void;
}

export function InicioMovil({ ctx, onAbrirHistorial }: Props) {
  const jornada = ctx.balance?.jornadaHoras ?? 0;
  const diaHoy = ctx.dias.find((d) => d.fecha === ctx.fechaHoy);
  const totalHoy = sumaHoras(ctx.porDia[ctx.fechaHoy] ?? []);
  const reqHoy = diaHoy?.laborable ? jornada : 0;
  const balanceMes = ctx.balance ? ctx.balance.horasImputadas - ctx.balance.requeridasEfectivas : null;

  const conLineas = ctx.dias
    .filter((d) => (ctx.porDia[d.fecha] ?? []).length > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 3);

  return (
    <div className="space-y-4 pt-2">
      <div className="card space-y-2 p-4">
        <p className="mono text-2xl font-extrabold">
          {fmt(totalHoy)} <small className="text-sm font-bold text-ink-tertiary">de {fmt(reqHoy)} h hoy</small>
        </p>
        <ProgressBar horas={totalHoy} requeridas={reqHoy} />
      </div>

      <div className="card grid grid-cols-3 divide-x divide-border p-4 text-center">
        <div>
          <p className="mono text-lg font-extrabold">{ctx.balance ? fmt(ctx.balance.horasImputadas) : '…'}</p>
          <p className="micro">Mes</p>
        </div>
        <div>
          <p className="mono text-lg font-extrabold">{ctx.balance ? fmt(ctx.balance.requeridasEfectivas) : '…'}</p>
          <p className="micro">Requeridas</p>
        </div>
        <div>
          <p className="mono text-lg font-extrabold">
            {balanceMes != null ? `${balanceMes > 0 ? '+' : ''}${fmt(balanceMes)}` : '…'}
          </p>
          <p className="micro">Balance</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">Últimos días imputados</h2>
          <button type="button" className="btn-text" onClick={onAbrirHistorial}>
            Ver todo
          </button>
        </div>
        {conLineas.length === 0 && <p className="text-sm text-ink-tertiary">Todavía no hay imputaciones.</p>}
        <div className="card divide-y divide-border px-4">
          {conLineas.map((d) => (
            <FilaDia
              key={d.fecha}
              fecha={d.fecha}
              dow={d.dow}
              lineas={ctx.porDia[d.fecha] ?? []}
              accion={{ texto: 'Reutilizar', onClick: () => ctx.reutilizarDia(d.fecha, true) }}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-extrabold">Calendario del mes</h2>
        <div className="card p-3">
          <CalendarGrid
            dias={ctx.dias}
            estadoDia={(d) => estadoDia(d.fecha, d.laborable, sumaHoras(ctx.porDia[d.fecha] ?? []), jornada, ctx.fechaHoy)}
            onClickDia={(fecha) => {
              ctx.setSelDay(fecha);
              ctx.setTab('imputar');
            }}
          />
        </div>
      </div>
    </div>
  );
}
