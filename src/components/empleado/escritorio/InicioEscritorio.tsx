'use client';

import { useState } from 'react';
import { ProgressBar } from '../compartido/ProgressBar';
import { FilaDia } from '../compartido/FilaDia';
import { CalendarGrid } from '../compartido/CalendarGrid';
import { ModalHistorico } from './ModalHistorico';
import { ModalCentrado } from '../compartido/ModalCentrado';
import { useComputarDia } from '../compartido/useComputarDia';
import { ausenciaEnFecha, CLASE_AUSENCIA_DIA, fmt, estadoDia, sumaHoras, formatoMesAnio, formatoDiaLargo } from '@/lib/horas/calendario';
import { IconHistorial, IconCalendario } from '@/components/ui/icons';
import type { EmpleadoCtx } from '../types';

export function InicioEscritorio({ ctx }: { ctx: EmpleadoCtx }) {
  const [historicoAbierto, setHistoricoAbierto] = useState(false);
  const computarDia = useComputarDia(ctx, ctx.fechaHoy);
  const diaHoy = ctx.dias.find((d) => d.fecha === ctx.fechaHoy);
  const totalHoy = sumaHoras(ctx.porDia[ctx.fechaHoy] ?? []);
  const reqHoy = diaHoy?.laborable ? diaHoy.jornada : 0;
  const balanceMes = ctx.balance ? ctx.balance.horasImputadas - ctx.balance.requeridasEfectivas : null;
  // Solo presentación (cero cálculo): sin ninguna hora imputada, el balance es simplemente "todo lo requerido" en negativo; se atenúa y se explica.
  const sinImputaciones = ctx.balance != null && ctx.balance.horasImputadas === 0;
  const restanteHoy = reqHoy - totalHoy;

  const conLineas = ctx.dias
    .filter((d) => (ctx.porDia[d.fecha] ?? []).length > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 4);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Hola, {ctx.nombre.split(' ')[0]}</h1>
          <p className="micro mt-0.5">
            {formatoDiaLargo(ctx.fechaHoy)} · {ctx.empresaNombre}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => ctx.setTab('imputar')}>
          ＋ Imputar hoy
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-6">
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-4">
          <div className="card space-y-2 p-4">
            <p className="mono text-2xl font-extrabold">
              {fmt(totalHoy)} <small className="text-sm font-bold text-ink-tertiary">de {fmt(reqHoy)} h hoy</small>
            </p>
            <ProgressBar horas={totalHoy} requeridas={reqHoy} />
            {reqHoy > 0 && (
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
                <span className={`h-[7px] w-[7px] rounded-full ${restanteHoy <= 0 ? 'bg-ink-primary' : 'border border-ink-primary'}`} />
                {restanteHoy > 0 ? `te quedan ${fmt(restanteHoy)} h` : restanteHoy === 0 ? 'día completo' : <s>{fmt(-restanteHoy)} h de más</s>}
              </p>
            )}
            {computarDia.pendientes.length > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => computarDia.setAbierto(true)}>
                Computar día
              </button>
            )}
          </div>
          <div className="card grid grid-cols-3 divide-x divide-border p-4 text-center">
            <div>
              <p className="mono text-base font-extrabold">{ctx.balance ? fmt(ctx.balance.horasImputadas) : '…'}</p>
              <p className="micro">Mes</p>
            </div>
            <div>
              <p className="mono text-base font-extrabold">{ctx.balance ? fmt(ctx.balance.requeridasEfectivas) : '…'}</p>
              <p className="micro">Req.</p>
            </div>
            <div>
              <p className={`mono text-base font-extrabold ${sinImputaciones ? 'text-ink-tertiary' : ''}`}>
                {balanceMes != null ? `${balanceMes > 0 ? '+' : ''}${fmt(balanceMes)}` : '…'}
              </p>
              <p className="micro">Balance</p>
            </div>
          </div>
          {sinImputaciones && <p className="micro mt-2 text-right text-ink-tertiary">Aún sin imputaciones este mes</p>}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <IconHistorial />
              Últimos días imputados
            </h2>
            <button type="button" className="btn-text" onClick={() => setHistoricoAbierto(true)}>
              Ver todo
            </button>
          </div>
          {conLineas.length === 0 ? (
            <p className="text-sm text-ink-tertiary">Todavía no hay imputaciones.</p>
          ) : (
            <div className="card divide-y divide-border px-4">
              {conLineas.map((d) => (
                <FilaDia
                  key={d.fecha}
                  fecha={d.fecha}
                  dow={d.dow}
                  lineas={ctx.porDia[d.fecha] ?? []}
                  accion={{ texto: 'Reutilizar día', onClick: () => ctx.reutilizarDia(d.fecha, true) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card sticky top-8 p-4">
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <IconCalendario />
            {formatoMesAnio(ctx.anio, ctx.mes)}
          </h2>
        </div>
        <CalendarGrid
          dias={ctx.dias}
          estadoDia={(d) => estadoDia(d.fecha, d.laborable, sumaHoras(ctx.porDia[d.fecha] ?? []), d.jornada, ctx.fechaHoy)}
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
            <span className="h-[7px] w-[7px] rounded-full border border-ink-primary" /> Parcial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-ink-disabled" /> Futuro
          </span>
        </div>
      </div>

      <ModalHistorico ctx={ctx} abierto={historicoAbierto} onCerrar={() => setHistoricoAbierto(false)} />

      <ModalCentrado abierto={computarDia.abierto} onCerrar={() => computarDia.setAbierto(false)} titulo="Computar día">
        <div className="space-y-4">
          <p className="text-sm">
            Vas a computar {computarDia.pendientes.length} línea{computarDia.pendientes.length === 1 ? '' : 's'} ({fmt(computarDia.horas)} h) de
            hoy para su aprobación. Las líneas computadas dejan de ser editables.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1 justify-center" onClick={() => computarDia.setAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary flex-1 justify-center" disabled={computarDia.computando} onClick={computarDia.confirmar}>
              {computarDia.computando ? 'Computando…' : 'Computar'}
            </button>
          </div>
        </div>
      </ModalCentrado>
      </div>
    </div>
  );
}
