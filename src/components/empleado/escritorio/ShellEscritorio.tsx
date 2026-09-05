'use client';

import { useState } from 'react';
import type { EmpleadoCtx } from '../types';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { InicioEscritorio } from './InicioEscritorio';
import { ImputarEscritorio } from './ImputarEscritorio';
import { CalendarioEscritorio } from './CalendarioEscritorio';

const TABS: { id: EmpleadoCtx['tab']; etiqueta: string }[] = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'imputar', etiqueta: 'Imputar' },
  { id: 'calendario', etiqueta: 'Calendario' },
];

export function ShellEscritorio(ctx: EmpleadoCtx) {
  const [mini, setMini] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className={`sticky top-0 flex h-screen shrink-0 flex-col gap-0.5 border-r border-border bg-surface p-3 ${mini ? 'w-16' : 'w-56'}`}>
        <div className="flex items-center justify-between px-2 pb-3">
          {!mini && <span className="text-sm font-extrabold">Horas Grupo</span>}
          <button
            type="button"
            onClick={() => setMini((v) => !v)}
            aria-label="Plegar menú"
            className="grid h-7 w-7 place-items-center rounded-lg border border-border text-ink-tertiary"
          >
            {mini ? '›' : '‹'}
          </button>
        </div>

        {!mini && <p className="micro px-2 pb-1">Mi registro</p>}
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => ctx.setTab(t.id)}
            className={`relative rounded-xl px-3 py-2 text-left text-sm font-extrabold ${
              t.id === ctx.tab ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
            } ${mini ? 'text-center' : ''}`}
          >
            {t.id === ctx.tab && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-ink-primary" />}
            {mini ? t.etiqueta[0] : t.etiqueta}
          </button>
        ))}

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
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
    </div>
  );
}
