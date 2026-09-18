'use client';

import Link from 'next/link';

import { useState } from 'react';
import { MenuUsuarioDesktop } from '@/components/ui/MenuUsuario';
import { IconReloj, IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import { GRUPOS_SECCIONES } from '../secciones';
import { useNavAdmin } from '../NavAdmin';
import type { AdminInfo } from '../types';
import { InicioEscritorio } from './InicioEscritorio';
import { UsuariosEscritorio } from './UsuariosEscritorio';
import { AusenciasEscritorio } from './AusenciasEscritorio';
import { EmpresasEscritorio } from './EmpresasEscritorio';
import { ProyectosEscritorio } from './ProyectosEscritorio';
import { CategoriasEscritorio } from './CategoriasEscritorio';
import { CalendarioEscritorio } from './CalendarioEscritorio';
import { MapaEscritorio } from './MapaEscritorio';
import { ControlEscritorio } from './ControlEscritorio';
import { TarifasEscritorio } from './TarifasEscritorio';
import { RefacturacionEscritorio } from './RefacturacionEscritorio';
import { AjustesEscritorio } from './AjustesEscritorio';
import { SoporteAdmin } from '../compartido/SoporteAdmin';
import { useTicketsAbiertos } from '@/hooks/admin/useTicketsAbiertos';

interface Props {
  info: AdminInfo;
}

export function ShellEscritorioAdmin({ info }: Props) {
  const [mini, setMini] = useState(false);
  const nav = useNavAdmin();
  const seccion = nav.seccion;
  const { abiertos, recargar: recargarAbiertos } = useTicketsAbiertos();

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className={`sticky top-0 flex h-screen shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-3 ${mini ? 'w-16' : 'w-60'}`}>
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

        {GRUPOS_SECCIONES.map((g) => (
          <div key={g.etiqueta}>
            {!mini && <p className="micro px-2 pb-1 pt-3 first:pt-0">{g.etiqueta}</p>}
            {g.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => nav.ir(item.id)}
                className={`relative flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold ${
                  item.id === seccion ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
                } ${mini ? 'justify-center' : ''}`}
              >
                {item.id === seccion && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-ink-primary" />}
                <item.Icono />
                {!mini && item.etiqueta}
                {item.id === 'soporte' && abiertos > 0 && (
                  <span
                    className={`mono rounded-full bg-accent px-1.5 py-px text-[10.5px] font-extrabold text-on-accent ${mini ? 'absolute right-1 top-1' : 'ml-auto'}`}
                    aria-label={`${abiertos} tickets abiertos`}
                    data-testid="badge-soporte"
                  >
                    {abiertos}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <MenuUsuarioDesktop nombre={info.nombre} email={info.email} rol={info.rol} />
          {!mini && (
            <Link href="/inicio" className="btn btn-sm flex-1 justify-center">
              App empleado
            </Link>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        {seccion === 'inicio' && <InicioEscritorio info={info} onIrA={(s) => nav.ir(s)} />}
        {seccion === 'usuarios' && <UsuariosEscritorio info={info} />}
        {seccion === 'ausencias' && <AusenciasEscritorio info={info} />}
        {seccion === 'empresas' && <EmpresasEscritorio info={info} />}
        {seccion === 'proyectos' && <ProyectosEscritorio info={info} />}
        {seccion === 'categorias' && <CategoriasEscritorio info={info} />}
        {seccion === 'calendario' && <CalendarioEscritorio info={info} />}
        {seccion === 'mapa' && <MapaEscritorio info={info} />}
        {seccion === 'control' && <ControlEscritorio />}
        {seccion === 'soporte' && <SoporteAdmin onCambioEstado={recargarAbiertos} />}
        {seccion === 'tarifas' && <TarifasEscritorio info={info} />}
        {seccion === 'refacturacion' && <RefacturacionEscritorio info={info} />}
        {seccion === 'ajustes' && <AjustesEscritorio info={info} />}
      </main>
    </div>
  );
}
