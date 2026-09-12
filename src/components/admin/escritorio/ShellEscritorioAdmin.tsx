'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MenuUsuarioDesktop } from '@/components/ui/MenuUsuario';
import { IconReloj, IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import { GRUPOS_SECCIONES } from '../secciones';
import type { AdminInfo, SeccionAdmin } from '../types';
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

interface Props {
  info: AdminInfo;
  seccion: SeccionAdmin;
  setSeccion: (s: SeccionAdmin) => void;
}

export function ShellEscritorioAdmin({ info, seccion, setSeccion }: Props) {
  const [mini, setMini] = useState(false);

  /**
   * Hand-off genérico entre secciones: "ir a X con este dato preseleccionado".
   * Sustituye el estado puntual que antes solo servía para Control -- ahora
   * también cubre abrir una ficha de Proyectos/Usuarios o precargar el
   * formulario de invitación con una empresa, todo desde la ficha de empresa.
   */
  const [handoff, setHandoff] = useState<{ seccion: SeccionAdmin; data: any } | null>(null);

  function irA(seccionDestino: SeccionAdmin, data?: any) {
    setHandoff(data !== undefined ? { seccion: seccionDestino, data } : null);
    setSeccion(seccionDestino);
  }
  function handoffPara(seccionActual: SeccionAdmin) {
    return handoff?.seccion === seccionActual ? handoff.data : undefined;
  }
  function consumirHandoff() {
    setHandoff(null);
  }

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
                onClick={() => setSeccion(item.id)}
                className={`relative flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold ${
                  item.id === seccion ? 'bg-subtle text-ink-primary' : 'text-ink-tertiary'
                } ${mini ? 'justify-center' : ''}`}
              >
                {item.id === seccion && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-ink-primary" />}
                <item.Icono />
                {!mini && item.etiqueta}
              </button>
            ))}
          </div>
        ))}

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <ThemeToggle />
          <MenuUsuarioDesktop nombre={info.nombre} email={info.email} rol={info.rol} />
          {!mini && (
            <a href="/" className="btn btn-sm flex-1 justify-center">
              App empleado
            </a>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        {seccion === 'inicio' && <InicioEscritorio info={info} onIrA={setSeccion} />}
        {seccion === 'usuarios' && (
          <UsuariosEscritorio
            info={info}
            onIrAControl={(empleadoId) => irA('control', { empleadoId })}
            preseleccion={handoffPara('usuarios')}
            onConsumirPreseleccion={consumirHandoff}
          />
        )}
        {seccion === 'ausencias' && <AusenciasEscritorio />}
        {seccion === 'empresas' && (
          <EmpresasEscritorio
            info={info}
            onIrAProyecto={(proyectoId) => irA('proyectos', { proyectoId })}
            onIrAUsuario={(usuarioId) => irA('usuarios', { usuarioId })}
            onIrAInvitarUsuario={(empresaId) => irA('usuarios', { empresaIdInvitar: empresaId })}
            onIrARefacturacion={() => irA('refacturacion')}
          />
        )}
        {seccion === 'proyectos' && <ProyectosEscritorio info={info} preseleccion={handoffPara('proyectos')?.proyectoId} onConsumirPreseleccion={consumirHandoff} />}
        {seccion === 'categorias' && <CategoriasEscritorio info={info} />}
        {seccion === 'calendario' && <CalendarioEscritorio info={info} />}
        {seccion === 'mapa' && <MapaEscritorio info={info} />}
        {seccion === 'control' && (
          <ControlEscritorio empleadoPreseleccionado={handoffPara('control')?.empleadoId ?? null} onConsumirPreseleccion={consumirHandoff} />
        )}
        {seccion === 'tarifas' && <TarifasEscritorio info={info} />}
        {seccion === 'refacturacion' && <RefacturacionEscritorio info={info} />}
        {seccion === 'ajustes' && <AjustesEscritorio info={info} />}
      </main>
    </div>
  );
}
