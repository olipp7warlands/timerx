'use client';

import { useState } from 'react';
import { ProgressBar } from '../compartido/ProgressBar';
import { FilaDia } from '../compartido/FilaDia';
import { CalendarGrid } from '../compartido/CalendarGrid';
import { ModalHistorico } from './ModalHistorico';
import { fmt, estadoDia, sumaHoras, formatoMesAnio } from '@/lib/horas/calendario';
import { IconHistorial, IconCalendario } from '@/components/ui/icons';
import type { EmpleadoCtx } from '../types';

export function InicioEscritorio({ ctx }: { ctx: EmpleadoCtx }) {
  const [historicoAbierto, setHistoricoAbierto] = useState(false);
  const jornada = ctx.balance?.jornadaHoras ?? 0;
  const diaHoy = ctx.dias.find((d) => d.fecha === ctx.fechaHoy);
  const totalHoy = sumaHoras(ctx.porDia[ctx.fechaHoy] ?? []);
  const reqHoy = diaHoy?.laborable ? jornada : 0;
  const balanceMes = ctx.balance ? ctx.balance.horasImputadas - ctx.balance.requeridasEfectivas : null;
  const restanteHoy = reqHoy - totalHoy;

  const conLineas = ctx.dias
    .filter((d) => (ctx.porDia[d.fecha] ?? []).length > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 4);

  return (
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
              <p className="mono text-base font-extrabold">
                {balanceMes != null ? `${balanceMes > 0 ? '+' : ''}${fmt(balanceMes)}` : '…'}
              </p>
              <p className="micro">Balance</p>
            </div>
          </div>
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
            <span className="h-[7px] w-[7px] rounded-full border border-ink-primary" /> Parcial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-ink-disabled" /> Futuro
          </span>
        </div>
      </div>

      <ModalHistorico ctx={ctx} abierto={historicoAbierto} onCerrar={() => setHistoricoAbierto(false)} />
    </div>
  );
}
