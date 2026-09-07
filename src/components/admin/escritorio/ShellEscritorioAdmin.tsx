'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { AdminInfo, SeccionAdmin } from '../types';
import { InicioEscritorio } from './InicioEscritorio';
import { UsuariosEscritorio } from './UsuariosEscritorio';
import { AusenciasEscritorio } from './AusenciasEscritorio';
import { EmpresasEscritorio } from './EmpresasEscritorio';
import { ProyectosEscritorio } from './ProyectosEscritorio';
import { CategoriasEscritorio } from './CategoriasEscritorio';
import { CalendarioEscritorio } from './CalendarioEscritorio';
import { ControlEscritorio } from './ControlEscritorio';
import { TarifasEscritorio } from './TarifasEscritorio';
import { RefacturacionEscritorio } from './RefacturacionEscritorio';
import { AjustesEscritorio } from './AjustesEscritorio';

interface Grupo {
  etiqueta: string;
  items: { id: SeccionAdmin; etiqueta: string }[];
}

const GRUPOS: Grupo[] = [
  { etiqueta: 'General', items: [{ id: 'inicio', etiqueta: 'Inicio' }] },
  {
    etiqueta: 'Personas',
    items: [
      { id: 'usuarios', etiqueta: 'Usuarios' },
      { id: 'ausencias', etiqueta: 'Ausencias' },
    ],
  },
  {
    etiqueta: 'Estructura',
    items: [
      { id: 'empresas', etiqueta: 'Empresas' },
      { id: 'proyectos', etiqueta: 'Proyectos' },
      { id: 'categorias', etiqueta: 'Categorías' },
      { id: 'calendario', etiqueta: 'Calendario' },
    ],
  },
  {
    etiqueta: 'Operación',
    items: [
      { id: 'control', etiqueta: 'Control' },
      { id: 'tarifas', etiqueta: 'Tarifas' },
      { id: 'refacturacion', etiqueta: 'Refacturaciones' },
    ],
  },
  { etiqueta: 'Sistema', items: [{ id: 'ajustes', etiqueta: 'Ajustes' }] },
];

interface Props {
  info: AdminInfo;
  seccion: SeccionAdmin;
  setSeccion: (s: SeccionAdmin) => void;
}

export function ShellEscritorioAdmin({ info, seccion, setSeccion }: Props) {
  const [mini, setMini] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className={`sticky top-0 flex h-screen shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-3 ${mini ? 'w-16' : 'w-60'}`}>
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

        {GRUPOS.map((g) => (
          <div key={g.etiqueta}>
            {!mini && <p className="micro px-2 pb-1 pt-3 first:pt-0">{g.etiqueta}</p>}
            {g.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSeccion(item.id)}
                className={`relative w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold ${
                  item.id === seccion ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
                } ${mini ? 'text-center' : ''}`}
              >
                {item.id === seccion && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-ink-primary" />}
                {mini ? item.etiqueta[0] : item.etiqueta}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <ThemeToggle />
          {!mini && (
            <a href="/" className="btn btn-sm flex-1 justify-center">
              App empleado
            </a>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        {seccion === 'inicio' && <InicioEscritorio info={info} />}
        {seccion === 'usuarios' && <UsuariosEscritorio info={info} />}
        {seccion === 'ausencias' && <AusenciasEscritorio />}
        {seccion === 'empresas' && <EmpresasEscritorio info={info} />}
        {seccion === 'proyectos' && <ProyectosEscritorio info={info} />}
        {seccion === 'categorias' && <CategoriasEscritorio info={info} />}
        {seccion === 'calendario' && <CalendarioEscritorio info={info} />}
        {seccion === 'control' && <ControlEscritorio />}
        {seccion === 'tarifas' && <TarifasEscritorio info={info} />}
        {seccion === 'refacturacion' && <RefacturacionEscritorio info={info} />}
        {seccion === 'ajustes' && <AjustesEscritorio info={info} />}
      </main>
    </div>
  );
}
