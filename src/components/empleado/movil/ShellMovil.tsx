'use client';

import { useState } from 'react';
import type { EmpleadoCtx } from '../types';
import { InicioMovil } from './InicioMovil';
import { ImputarMovil } from './ImputarMovil';
import { CalendarioMovil } from './CalendarioMovil';
import { NuevaImputacionSheet, type PasoInicial } from './NuevaImputacionSheet';
import { HistorialSheet } from './HistorialSheet';
import { MapaSheet } from './MapaSheet';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { IconCasa, IconReloj, IconCalendario, IconMas, IconMapa } from '@/components/ui/icons';
import { ausenciaEnFecha, formatoDiaLargo } from '@/lib/horas/calendario';

const TABS: { id: EmpleadoCtx['tab']; etiqueta: string; Icono: typeof IconCasa }[] = [
  { id: 'inicio', etiqueta: 'Inicio', Icono: IconCasa },
  { id: 'imputar', etiqueta: 'Imputar', Icono: IconReloj },
  { id: 'calendario', etiqueta: 'Calendario', Icono: IconCalendario },
];

export function ShellMovil(ctx: EmpleadoCtx) {
  const [wizard, setWizard] = useState<{ abierto: boolean; paso: PasoInicial; destinoStaged: boolean }>({
    abierto: false,
    paso: 'tipo',
    destinoStaged: false,
  });
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  function abrirHoja(paso: PasoInicial = 'tipo', destinoStaged = false) {
    setWizard({ abierto: true, paso, destinoStaged });
  }

  function abrirFab() {
    if (ctx.tab !== 'imputar') {
      ctx.setTab('imputar');
      ctx.setSelDay(ctx.fechaHoy);
    }
    abrirHoja('tipo', false);
  }

  const fabBloqueado = ctx.tab === 'imputar' && ausenciaEnFecha(ctx.selDay, ctx.ausencias)?.estado === 'aprobada';

  const iniciales = ctx.nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-bg pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <p className="text-base font-extrabold">Hola, {ctx.nombre.split(' ')[0]}</p>
          <p className="micro">
            {formatoDiaLargo(ctx.fechaHoy)} · {ctx.empresaNombre}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMapaAbierto(true)}
            aria-label="Mapa del grupo"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-secondary shadow-[var(--sombra)]"
          >
            <IconMapa />
          </button>
          <ThemeToggle />
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-extrabold text-on-accent">{iniciales}</div>
        </div>
      </header>

      <div className="px-5">
        {ctx.tab === 'inicio' && <InicioMovil ctx={ctx} />}
        {ctx.tab === 'imputar' && (
          <ImputarMovil ctx={ctx} onAbrirHoja={abrirHoja} onAbrirHistorial={() => setHistorialAbierto(true)} />
        )}
        {ctx.tab === 'calendario' && <CalendarioMovil ctx={ctx} />}
      </div>

      <button
        type="button"
        onClick={fabBloqueado ? undefined : abrirFab}
        disabled={fabBloqueado}
        title={fabBloqueado ? 'Tienes una ausencia aprobada este día' : undefined}
        aria-label="Nueva imputación"
        className="fixed right-4 z-[5] flex items-center gap-2 rounded-full bg-accent px-[22px] py-[15px] text-sm font-extrabold text-on-accent shadow-[0_6px_18px_rgba(30,30,28,.22)] disabled:opacity-40"
        style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        <IconMas />
        Imputar
      </button>

      <nav
        className="fixed inset-x-0 bottom-0 z-[5] flex gap-1 border-t border-border bg-surface px-2 pt-2"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => ctx.setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[10px] font-extrabold ${
              t.id === ctx.tab ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
            }`}
          >
            <t.Icono size={20} />
            {t.etiqueta}
          </button>
        ))}
      </nav>

      <NuevaImputacionSheet
        ctx={ctx}
        abierto={wizard.abierto}
        pasoInicial={wizard.paso}
        destinoStaged={wizard.destinoStaged}
        onCerrar={() => setWizard((w) => ({ ...w, abierto: false }))}
      />
      <HistorialSheet ctx={ctx} abierto={historialAbierto} onCerrar={() => setHistorialAbierto(false)} />
      <MapaSheet abierto={mapaAbierto} onCerrar={() => setMapaAbierto(false)} />
    </div>
  );
}
