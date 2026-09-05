'use client';

import { useState } from 'react';
import type { EmpleadoCtx } from '../types';
import { InicioMovil } from './InicioMovil';
import { ImputarMovil } from './ImputarMovil';
import { CalendarioMovil } from './CalendarioMovil';
import { NuevaImputacionSheet, type PasoInicial } from './NuevaImputacionSheet';
import { HistorialSheet } from './HistorialSheet';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const TABS: { id: EmpleadoCtx['tab']; etiqueta: string }[] = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'imputar', etiqueta: 'Imputar' },
  { id: 'calendario', etiqueta: 'Calendario' },
];

export function ShellMovil(ctx: EmpleadoCtx) {
  const [wizard, setWizard] = useState<{ abierto: boolean; paso: PasoInicial; destinoStaged: boolean }>({
    abierto: false,
    paso: 'tipo',
    destinoStaged: false,
  });
  const [historialAbierto, setHistorialAbierto] = useState(false);

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

  return (
    <div className="min-h-screen bg-bg pb-20">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <p className="text-base font-extrabold">Hola, {ctx.nombre.split(' ')[0]}</p>
          <p className="micro">{ctx.empresaNombre}</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-5">
        {ctx.tab === 'inicio' && <InicioMovil ctx={ctx} onAbrirHistorial={() => setHistorialAbierto(true)} />}
        {ctx.tab === 'imputar' && (
          <ImputarMovil ctx={ctx} onAbrirHoja={abrirHoja} onAbrirHistorial={() => setHistorialAbierto(true)} />
        )}
        {ctx.tab === 'calendario' && <CalendarioMovil ctx={ctx} />}
      </div>

      <button
        type="button"
        onClick={abrirFab}
        aria-label="Nueva imputación"
        className="fixed bottom-24 right-5 grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-on-accent shadow-[var(--sombra)]"
      >
        +
      </button>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => ctx.setTab(t.id)}
            className={`flex-1 py-3 text-xs font-extrabold ${t.id === ctx.tab ? 'text-ink-primary' : 'text-ink-tertiary'}`}
          >
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
    </div>
  );
}
