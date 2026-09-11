'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MenuUsuarioMovil } from '@/components/ui/MenuUsuario';
import { IconMenu, IconReloj } from '@/components/ui/icons';
import { GRUPOS_SECCIONES, SECCIONES_MOVIL_FUNCIONALES } from '../secciones';
import type { AdminInfo, SeccionAdmin } from '../types';
import { InicioMovil } from './InicioMovil';
import { AusenciasMovil } from './AusenciasMovil';
import { OtraSeccionMovil } from './OtraSeccionMovil';
import { MapaMovil } from './MapaMovil';

const ETIQUETAS: Record<SeccionAdmin, string> = {
  inicio: 'Inicio',
  usuarios: 'Usuarios',
  ausencias: 'Ausencias',
  empresas: 'Empresas',
  proyectos: 'Proyectos',
  categorias: 'Categorías',
  calendario: 'Calendario',
  mapa: 'Mapa',
  control: 'Control',
  tarifas: 'Tarifas',
  refacturacion: 'Refacturaciones',
  ajustes: 'Ajustes',
};

interface Props {
  info: AdminInfo;
  seccion: SeccionAdmin;
  setSeccion: (s: SeccionAdmin) => void;
}

export function ShellMovilAdmin({ info, seccion, setSeccion }: Props) {
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg pb-11">
      <header className="flex items-start justify-between px-4.5 pb-3 pt-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setDrawerAbierto(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-secondary shadow-[var(--sombra)]"
          >
            <IconMenu />
          </button>
          <div>
            <h1 className="text-[23px] font-extrabold leading-tight">{ETIQUETAS[seccion]}</h1>
            <p className="mt-0.5 text-xs text-ink-tertiary">Horas Grupo · {info.empresaNombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MenuUsuarioMovil nombre={info.nombre} email={info.email} rol={info.rol} />
        </div>
      </header>

      <div className="px-4.5">
        {seccion === 'inicio' && <InicioMovil />}
        {seccion === 'ausencias' && <AusenciasMovil />}
        {seccion === 'mapa' && <MapaMovil />}
        {!SECCIONES_MOVIL_FUNCIONALES.includes(seccion) && <OtraSeccionMovil titulo={ETIQUETAS[seccion]} />}
      </div>

      {drawerAbierto && <div className="fixed inset-0 z-10 bg-black/35" onClick={() => setDrawerAbierto(false)} />}
      <aside
        className={`fixed left-0 top-0 z-20 flex h-full w-[272px] flex-col overflow-y-auto border-r border-border bg-surface p-3 pb-6 transition-transform ${
          drawerAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menú de secciones"
      >
        <div className="flex items-center gap-2 px-2 pb-3 text-[17px] font-extrabold">
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-accent text-on-accent">
            <IconReloj size={17} />
          </span>
          Horas Grupo
        </div>
        {GRUPOS_SECCIONES.map((g) => (
          <div key={g.etiqueta}>
            <p className="micro px-3 pb-1 pt-3 first:pt-0">{g.etiqueta}</p>
            {g.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSeccion(item.id);
                  setDrawerAbierto(false);
                }}
                className={`relative flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold ${
                  item.id === seccion ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
                }`}
              >
                {item.id === seccion && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-ink-primary" />}
                <item.Icono />
                {item.etiqueta}
              </button>
            ))}
          </div>
        ))}
        <a href="/admin" className="btn mt-auto w-full justify-center border-t border-border pt-3">
          Panel de escritorio
        </a>
      </aside>
    </div>
  );
}
