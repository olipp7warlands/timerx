'use client';

import { useState } from 'react';
import { CatDot } from '../compartido/CatDot';
import { Stepper } from '../compartido/Stepper';
import { ProgressBar } from '../compartido/ProgressBar';
import { LineaImputacion } from '../compartido/LineaImputacion';
import { ListaConUsar } from '../compartido/ListaConUsar';
import { BottomSheet } from '../compartido/BottomSheet';
import { CalendarGrid } from '../compartido/CalendarGrid';
import { diaAdyacenteLaborable, estadoDia, fmt, nombreDia, sumaHoras } from '@/lib/horas/calendario';
import { IconCalendario, IconHoy, IconHistorial, IconArchivo } from '@/components/ui/icons';
import type { PasoInicial } from './NuevaImputacionSheet';
import type { EmpleadoCtx } from '../types';

interface Props {
  ctx: EmpleadoCtx;
  onAbrirHoja: (paso: PasoInicial, destinoStaged: boolean) => void;
  onAbrirHistorial: () => void;
}

export function ImputarMovil({ ctx, onAbrirHoja, onAbrirHistorial }: Props) {
  const [pickerAbierto, setPickerAbierto] = useState(false);
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
    .slice(0, 2)
    .map((d) => ({ fecha: d.fecha, dow: d.dow, lineas: ctx.porDia[d.fecha] ?? [] }));

  const totalStaged = ctx.staged?.lineas.reduce((s, l) => s + l.horas, 0) ?? 0;

  return (
    <div className="space-y-4 pt-2">
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <button type="button" disabled={!prev} className="text-xl disabled:opacity-30" onClick={() => prev && ctx.setSelDay(prev)}>
            ‹
          </button>
          <button type="button" className="flex items-center gap-1.5 text-center" onClick={() => setPickerAbierto(true)}>
            <span>
              <p className="text-sm font-extrabold">
                {diaSel ? `${nombreDia(diaSel.dow)} ${Number(diaSel.fecha.slice(-2))}` : ''}
              </p>
              <p className="micro">{ctx.selDay === ctx.fechaHoy ? 'Hoy' : ''}</p>
            </span>
            <IconCalendario />
          </button>
          <button type="button" disabled={!next} className="text-xl disabled:opacity-30" onClick={() => next && ctx.setSelDay(next)}>
            ›
          </button>
        </div>
        <p className="mono text-xl font-extrabold">
          {fmt(totalDia)} <small className="text-sm font-bold text-ink-tertiary">de {fmt(reqDia)} h</small>
        </p>
        <ProgressBar horas={totalDia} requeridas={reqDia} />
      </div>

      {ctx.staged && (
        <div className="card space-y-3 border-dashed p-4">
          <div className="flex items-center justify-between">
            <b className="text-sm">Precargado del {Number(ctx.staged.origen.slice(-2))}</b>
            <span className="mono text-sm">{fmt(totalStaged)} h</span>
          </div>
          {ctx.staged.lineas.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CatDot categoria={l.categoriaNombre} />
                <span className="truncate">
                  {l.proyectoNombre} · {l.subcategoriaNombre}
                </span>
              </span>
              <Stepper value={l.horas} max={ctx.maxHorasDia ?? 12} onChange={(h) => ctx.ajustarLineaStaged(i, h)} />
            </div>
          ))}
          <button type="button" className="add-line flex items-center gap-2 text-xs font-extrabold" onClick={() => onAbrirHoja('proyecto', true)}>
            <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-ink-primary">＋</span>
            Imputar nueva tarea
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1 justify-center" onClick={ctx.descartarStaged}>
              Descartar
            </button>
            <button type="button" className="btn btn-primary flex-1 justify-center" onClick={ctx.confirmarStaged}>
              Confirmar
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <IconHoy />
          {ctx.selDay === ctx.fechaHoy ? 'Hoy' : `${nombreDia(diaSel?.dow ?? 0)} ${Number(ctx.selDay.slice(-2))}`}
        </p>
        {lineasHoy.length > 0 ? (
          <div className="card divide-y divide-border px-4">
            {lineasHoy.map((l) => (
              <LineaImputacion
                key={l.id}
                linea={l}
                maxHorasDia={ctx.maxHorasDia}
                onAjustar={(h) => ctx.ajustarHorasLinea(l.id, h)}
                onEliminar={() => ctx.eliminarLinea(l.id)}
              />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-ink-tertiary">No has imputado nada.</p>
            <button type="button" className="btn-dashed" onClick={() => onAbrirHoja('tipo', false)}>
              ＋ Imputar
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <IconHistorial />
            Últimas imputaciones
          </h2>
          <button type="button" className="btn-text flex items-center gap-1.5" onClick={onAbrirHistorial}>
            <IconArchivo size={14} />
            Imputaciones anteriores
          </button>
        </div>
        {diasRecientes.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Todavía no hay imputaciones.</p>
        ) : (
          <div className="card px-4 py-3">
            <ListaConUsar dias={diasRecientes} onUsar={(l) => ctx.usarLinea(l, ctx.selDay)} />
          </div>
        )}
      </div>

      <BottomSheet abierto={pickerAbierto} onCerrar={() => setPickerAbierto(false)} titulo="Elige el día">
        <CalendarGrid
          dias={ctx.dias}
          estadoDia={(d) => estadoDia(d.fecha, d.laborable, sumaHoras(ctx.porDia[d.fecha] ?? []), jornada, ctx.fechaHoy)}
          claseExtra={(d) => (d.fecha === ctx.selDay ? 'bg-accent text-on-accent border-accent' : '')}
          onClickDia={(fecha) => {
            ctx.setSelDay(fecha);
            setPickerAbierto(false);
          }}
        />
      </BottomSheet>
    </div>
  );
}
