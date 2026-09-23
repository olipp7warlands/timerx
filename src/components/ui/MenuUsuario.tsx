'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/auth/roles';
import { BottomSheet } from '@/components/empleado/compartido/BottomSheet';
import { ModalCentrado } from '@/components/empleado/compartido/ModalCentrado';
import { alternarTema } from './ThemeToggle';
import { CambiarPasswordForm } from './CambiarPasswordForm';
import { IconTema, IconSol, IconLlave, IconSoporte, IconSalida } from './icons';

interface Props {
  nombre: string;
  email: string;
  rol: RolUsuario;
  /** Soporte es una página (`/soporte`, deep-link/atrás/F5), no un modal ni una hoja: el ítem del menú navega, en los dos shells. */
  onIrSoporte: () => void;
}

/**
 * Navegación dura (no router.push): la navegación cliente de Next
 * conservaría el árbol de componentes y el estado en memoria de hooks con
 * datos del usuario anterior tras signOut().
 */
export async function cerrarSesion() {
  await createClient().auth.signOut();
  window.location.assign('/login');
}

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Cabecera({ nombre, email, rol }: Pick<Props, 'nombre' | 'email' | 'rol'>) {
  return (
    <div>
      <p className="text-sm font-extrabold">{nombre}</p>
      <p className="mt-0.5 truncate text-xs text-ink-tertiary">{email}</p>
      <p className="mt-1 text-xs font-extrabold text-ink-secondary">{ETIQUETA_ROL[rol]}</p>
    </div>
  );
}

/**
 * Modo DESTINO del tema (a qué se cambiaría si se pulsa ahora), no el modo actual -- icono y etiqueta lo dicen
 * explícitamente. Lectura perezosa en el propio `useState` (una sola vez, al montar el menú -- que solo ocurre en
 * cliente): nada más que este mismo `alternar()` cambia el tema entre el montaje y la primera apertura, así que no
 * hace falta releerlo en un efecto en cada apertura.
 */
function useTemaDestino() {
  const [oscuroActivo, setOscuroActivo] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark');
  const alternar = () => {
    alternarTema();
    setOscuroActivo((v) => !v);
  };
  return oscuroActivo
    ? { alternar, Icono: IconSol, etiqueta: 'Cambiar a modo día' }
    : { alternar, Icono: IconTema, etiqueta: 'Cambiar a modo noche' };
}

export function MenuUsuarioDesktop({ nombre, email, rol, onIrSoporte }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [passwordAbierto, setPasswordAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tema = useTemaDestino();

  useEffect(() => {
    if (!abierto) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Cuenta"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-on-accent"
      >
        {iniciales(nombre)}
      </button>
      {abierto && (
        <div role="menu" className="card absolute bottom-full left-0 z-50 mb-2 w-60 overflow-hidden py-1 shadow-[var(--sombra)]">
          <div className="border-b border-border px-3.5 py-3">
            <Cabecera nombre={nombre} email={email} rol={rol} />
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={tema.alternar}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-bold text-ink-primary hover:bg-subtle"
          >
            <tema.Icono size={16} />
            {tema.etiqueta}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAbierto(false);
              setPasswordAbierto(true);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-bold text-ink-primary hover:bg-subtle"
          >
            <IconLlave size={16} />
            Cambiar contraseña
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAbierto(false);
              onIrSoporte();
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-bold text-ink-primary hover:bg-subtle"
          >
            <IconSoporte size={16} />
            Soporte
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={cerrarSesion}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-bold text-ink-primary hover:bg-subtle"
          >
            <IconSalida size={16} />
            Cerrar sesión
          </button>
        </div>
      )}

      <ModalCentrado abierto={passwordAbierto} onCerrar={() => setPasswordAbierto(false)} titulo="Cambiar contraseña">
        <CambiarPasswordForm email={email} onExito={() => setPasswordAbierto(false)} />
      </ModalCentrado>
    </div>
  );
}

export function MenuUsuarioMovil({ nombre, email, rol, onIrSoporte }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [passwordAbierto, setPasswordAbierto] = useState(false);
  const tema = useTemaDestino();

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Cuenta"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-on-accent"
      >
        {iniciales(nombre)}
      </button>
      <BottomSheet abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cuenta">
        <div className="border-b border-border pb-3">
          <Cabecera nombre={nombre} email={email} rol={rol} />
        </div>
        <button type="button" onClick={tema.alternar} className="btn full mt-3 flex w-full items-center justify-center gap-2">
          <tema.Icono size={16} />
          {tema.etiqueta}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setPasswordAbierto(true);
          }}
          className="btn full mt-2 flex w-full items-center justify-center gap-2"
        >
          <IconLlave size={16} />
          Cambiar contraseña
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            onIrSoporte();
          }}
          className="btn full mt-2 flex w-full items-center justify-center gap-2"
        >
          <IconSoporte size={16} />
          Soporte
        </button>
        <button type="button" onClick={cerrarSesion} className="btn btn-primary full mt-2 flex w-full items-center justify-center gap-2">
          <IconSalida size={16} />
          Cerrar sesión
        </button>
      </BottomSheet>
      <BottomSheet abierto={passwordAbierto} onCerrar={() => setPasswordAbierto(false)} titulo="Cambiar contraseña">
        <CambiarPasswordForm email={email} onExito={() => setPasswordAbierto(false)} />
      </BottomSheet>
    </>
  );
}
