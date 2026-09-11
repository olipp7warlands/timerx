'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/auth/roles';
import { BottomSheet } from '@/components/empleado/compartido/BottomSheet';

interface Props {
  nombre: string;
  email: string;
  rol: RolUsuario;
}

/**
 * Navegación dura (no router.push): la navegación cliente de Next
 * conservaría el árbol de componentes y el estado en memoria de hooks con
 * datos del usuario anterior tras signOut().
 */
async function cerrarSesion() {
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

function Cabecera({ nombre, email, rol }: Props) {
  return (
    <div>
      <p className="text-sm font-extrabold">{nombre}</p>
      <p className="mt-0.5 truncate text-xs text-ink-tertiary">{email}</p>
      <p className="mt-1 text-xs font-extrabold text-ink-secondary">{ETIQUETA_ROL[rol]}</p>
    </div>
  );
}

export function MenuUsuarioDesktop({ nombre, email, rol }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
            onClick={cerrarSesion}
            className="block w-full px-3.5 py-2.5 text-left text-sm font-bold text-ink-primary hover:bg-subtle"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function MenuUsuarioMovil({ nombre, email, rol }: Props) {
  const [abierto, setAbierto] = useState(false);

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
        <button type="button" onClick={cerrarSesion} className="btn btn-primary full mt-3 w-full justify-center">
          Cerrar sesión
        </button>
      </BottomSheet>
    </>
  );
}
