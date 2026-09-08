'use client';

import { useState } from 'react';
import { CatDot } from '../compartido/CatDot';
import { Stepper } from '../compartido/Stepper';
import { ProgressBar } from '../compartido/ProgressBar';
import { FilaDia } from '../compartido/FilaDia';
import { CalendarGrid } from '../compartido/CalendarGrid';
import { ComposerLinea } from './ComposerLinea';
import { PrecargadoEscritorio } from './PrecargadoEscritorio';
import { ModalHistorico } from './ModalHistorico';
import { AvisoAusenciaDia } from '../compartido/AvisoAusenciaDia';
import { ausenciaEnFecha, CLASE_AUSENCIA_DIA, diaAdyacenteLaborable, estadoDia, fmt, formatoMesAnio, nombreDia, sumaHoras } from '@/lib/horas/calendario';
import { IconCalendario, IconHistorial, IconHoy } from '@/components/ui/icons';
import type { EmpleadoCtx } from '../types';

const ESTADO_ETIQUETA: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
};

export function ImputarEscritorio({ ctx }: { ctx: EmpleadoCtx }) {
  const [historicoAbierto, setHistoricoAbierto] = useState(false);
  const jornada = ctx.balance?.jornadaHoras ?? 0;

  const diaSel = ctx.dias.find((d) => d.fecha === ctx.selDay);
  const lineasHoy = ctx.porDia[ctx.selDay] ?? [];
  const totalDia = sumaHoras(lineasHoy);
  const reqDia = diaSel?.laborable ? jornada : 0;
  const prev = diaAdyacenteLaborable(ctx.dias, ctx.selDay, -1);
  const next = diaAdyacenteLaborable(ctx.dias, ctx.selDay, 1);

  const diasRecientes = ctx.dias
    .filter((d) => d.fecha !== ctx.selDay && (ctx.porDia[d.fecha] ?? []).length > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 3);

  const ausenciaDia = ausenciaEnFecha(ctx.selDay, ctx.ausencias);
  const bloqueadoPorAusencia = ausenciaDia?.estado === 'aprobada';
  const proyectosDia = ctx.proyectosParaFechas([ctx.selDay]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-6">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between pb-3">
            <button type="button" disabled={!prev} className="text-xl disabled:opacity-30" onClick={() => prev && ctx.setSelDay(prev)}>
              ‹
            </button>
            <div className="text-center">
              <p className="text-sm font-extrabold">{diaSel ? `${nombreDia(diaSel.dow)} ${Number(diaSel.fecha.slice(-2))}` : ''}</p>
              <p className="micro">{ctx.selDay === ctx.fechaHoy ? 'Hoy' : ''}</p>
            </div>
            <button type="button" disabled={!next} className="text-xl disabled:opacity-30" onClick={() => next && ctx.setSelDay(next)}>
              ›
            </button>
          </div>
          <div className="flex items-center gap-4">
            <p className="mono shrink-0 text-lg font-extrabold">
              {fmt(totalDia)} <small className="text-sm font-bold text-ink-tertiary">de {fmt(reqDia)} h</small>
            </p>
            <div className="flex-1">
              <ProgressBar horas={totalDia} requeridas={reqDia} />
            </div>
          </div>
        </div>

        <AvisoAusenciaDia ausencia={ausenciaDia} />

        {!bloqueadoPorAusencia && <PrecargadoEscritorio ctx={ctx} />}

        <div className="card">
          <div className="card-head">
            <h2 className="flex items-center gap-2">
              <IconHoy />
              {ctx.selDay === ctx.fechaHoy ? 'Hoy' : `${nombreDia(diaSel?.dow ?? 0)} ${Number(ctx.selDay.slice(-2))}`}
            </h2>
            {lineasHoy.length > 0 && <span className="mono text-sm">{fmt(totalDia)} h</span>}
          </div>
          <div className="card-body space-y-1">
            {lineasHoy.length === 0 && !bloqueadoPorAusencia && (
              <p className="py-2 text-sm text-ink-tertiary">No has imputado nada este día — añade la primera línea aquí abajo.</p>
            )}
            {lineasHoy.map((l) => {
              const editable = l.estado === 'borrador' || l.estado === 'rechazada';
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <CatDot categoria={l.categoriaNombre} />
                    <b className="truncate font-extrabold">
                      {l.proyectoNombre} · {l.subcategoriaNombre}
                    </b>
                    <span className="shrink-0 text-xs text-ink-secondary">{l.empresaNombre}</span>
                  </span>
                  {editable ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <Stepper value={l.horas} max={ctx.maxHorasDia ?? 12} onChange={(h) => ctx.ajustarHorasLinea(l.id, h)} />
                      <button type="button" className="btn btn-sm" onClick={() => ctx.eliminarLinea(l.id)} aria-label="Eliminar línea">
                        ✕
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-tertiary">
                      <span className="mono">{fmt(l.horas)} h</span>
                      <span>{ESTADO_ETIQUETA[l.estado] ?? l.estado}</span>
                    </span>
                  )}
                </div>
              );
            })}
            {bloqueadoPorAusencia ? (
              <p className="py-2 text-sm font-extrabold text-ink-secondary">No puedes añadir horas: tienes una ausencia aprobada este día.</p>
            ) : proyectosDia.length === 0 ? (
              <p className="py-2 text-sm text-ink-tertiary">No tienes proyectos asignados para este día. Habla con tu administrador.</p>
            ) : (
              <ComposerLinea proyectos={proyectosDia} grupos={ctx.grupos} maxHorasDia={ctx.maxHorasDia} onAnadir={(l) => ctx.guardarHoras({ proyectoId: l.proyectoId, subcategoriaId: l.subcategoriaId, horas: l.horas, fecha: ctx.selDay })} />
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <IconHistorial />
              Anteriores imputaciones
            </h2>
            <button type="button" className="btn-text" onClick={() => setHistoricoAbierto(true)}>
              Ver todo
            </button>
          </div>
          {diasRecientes.length === 0 ? (
            <p className="text-sm text-ink-tertiary">Todavía no hay imputaciones.</p>
          ) : (
            <div className="card divide-y divide-border px-4">
              {diasRecientes.map((d) => (
                <FilaDia
                  key={d.fecha}
                  fecha={d.fecha}
                  dow={d.dow}
                  lineas={ctx.porDia[d.fecha] ?? []}
                  accion={{ texto: 'Reutilizar día', onClick: () => ctx.reutilizarDia(d.fecha, false) }}
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
          <p className="micro">Clic en un día para imputarlo</p>
        </div>
        <CalendarGrid
          dias={ctx.dias}
          estadoDia={(d) => estadoDia(d.fecha, d.laborable, sumaHoras(ctx.porDia[d.fecha] ?? []), jornada, ctx.fechaHoy)}
          claseExtra={(d) =>
            ausenciaEnFecha(d.fecha, ctx.ausencias)
              ? CLASE_AUSENCIA_DIA
              : d.fecha === ctx.selDay
                ? 'bg-accent text-on-accent border-accent'
                : ''
          }
          onClickDia={(fecha) => ctx.setSelDay(fecha)}
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
