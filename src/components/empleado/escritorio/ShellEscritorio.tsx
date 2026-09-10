'use client';

import { useState } from 'react';
import type { EmpleadoCtx } from '../types';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { IconReloj, IconChevronLeft, IconChevronRight, IconCasa, IconCalendario, IconMapa } from '@/components/ui/icons';
import { InicioEscritorio } from './InicioEscritorio';
import { ImputarEscritorio } from './ImputarEscritorio';
import { CalendarioEscritorio } from './CalendarioEscritorio';
import { ModalMapa } from './ModalMapa';

const TABS: { id: EmpleadoCtx['tab']; etiqueta: string; Icono: typeof IconCasa }[] = [
  { id: 'inicio', etiqueta: 'Inicio', Icono: IconCasa },
  { id: 'imputar', etiqueta: 'Imputar', Icono: IconReloj },
  { id: 'calendario', etiqueta: 'Calendario', Icono: IconCalendario },
];

export function ShellEscritorio(ctx: EmpleadoCtx) {
  const [mini, setMini] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className={`sticky top-0 flex h-screen shrink-0 flex-col gap-0.5 border-r border-border bg-surface p-3 ${mini ? 'w-16' : 'w-56'}`}>
        <div className="flex items-center justify-between px-2 pb-3">
          {!mini && (
            <span className="flex items-center gap-2 text-sm font-extrabold">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-accent text-on-accent">
                <IconReloj size={17} />
              </span>
              Horas Grupo
            </span>
          )}
          <button
            type="button"
            onClick={() => setMini((v) => !v)}
            aria-label="Plegar menú"
            className="grid h-7 w-7 place-items-center rounded-lg border border-border text-ink-tertiary"
          >
            {mini ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {!mini && <p className="micro px-2 pb-1">Mi registro</p>}
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => ctx.setTab(t.id)}
            className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-extrabold ${
              t.id === ctx.tab ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
            } ${mini ? 'justify-center' : ''}`}
          >
            {t.id === ctx.tab && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-ink-primary" />}
            <t.Icono />
            {!mini && t.etiqueta}
          </button>
        ))}

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setMapaAbierto(true)}
            aria-label="Mapa del grupo"
            title="Mapa del grupo"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-secondary shadow-[var(--sombra)]"
          >
            <IconMapa />
          </button>
          <ThemeToggle />
          {!mini && (
            <a href="/admin" className="btn btn-sm flex-1 justify-center">
              Panel admin
            </a>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        {ctx.tab === 'inicio' && <InicioEscritorio ctx={ctx} />}
        {ctx.tab === 'imputar' && <ImputarEscritorio ctx={ctx} />}
        {ctx.tab === 'calendario' && <CalendarioEscritorio ctx={ctx} />}
      </main>

      <ModalMapa abierto={mapaAbierto} onCerrar={() => setMapaAbierto(false)} />
    </div>
  );
}
