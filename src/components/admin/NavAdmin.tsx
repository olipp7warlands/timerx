'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { navegar, reemplazar } from '@/lib/nav/navegar';
import { parseRutaAdmin, urlAdmin } from '@/lib/nav/rutas';
import type { SeccionAdmin } from './types';

interface IrOpts {
  fichaId?: string;
  /** Hand-off efímero (`?empleado=`, `?invitar=`): quien lo recibe lo consume y llama a `limpiarConsulta`. */
  query?: Record<string, string>;
  /** `replace` en vez de `push` (p. ej. ficha inexistente: no dejar la URL rota en el historial). */
  reemplazar?: boolean;
  /** Cambio de estado DENTRO de la misma vista (p. ej. día seleccionado): no saltar al inicio de la página. */
  conservarScroll?: boolean;
}

export interface NavAdmin {
  seccion: SeccionAdmin;
  fichaId: string | null;
  consulta: URLSearchParams;
  ir: (seccion: SeccionAdmin, opts?: IrOpts) => void;
  limpiarConsulta: () => void;
}

const Ctx = createContext<NavAdmin | null>(null);

export function useNavAdmin(): NavAdmin {
  const nav = useContext(Ctx);
  if (!nav) throw new Error('useNavAdmin fuera de <NavAdminProvider>');
  return nav;
}

/** Sección y ficha se DERIVAN de la URL (única fuente de verdad); navegar = cambiar la URL. */
function ProveedorUrl({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const consulta = useSearchParams();

  const ruta = useMemo(() => parseRutaAdmin(pathname.split('/').filter(Boolean).slice(1)), [pathname]);

  const ir = useCallback((seccion: SeccionAdmin, opts?: IrOpts) => {
    const url = urlAdmin(seccion, opts);
    if (opts?.reemplazar) reemplazar(url);
    else navegar(url, { conservarScroll: opts?.conservarScroll });
  }, []);
  const limpiarConsulta = useCallback(() => reemplazar(pathname), [pathname]);

  const value = useMemo<NavAdmin>(
    () => ({ seccion: ruta?.seccion ?? 'inicio', fichaId: ruta?.fichaId ?? null, consulta, ir, limpiarConsulta }),
    [ruta, consulta, ir, limpiarConsulta]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Solo /debug/movil-admin (verificación visual, 404 en producción): esa page
 * no vive bajo /admin/*, así que la navegación se aísla en estado local.
 */
function ProveedorAislado({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<{ seccion: SeccionAdmin; fichaId: string | null }>({ seccion: 'inicio', fichaId: null });
  const ir = useCallback((seccion: SeccionAdmin, opts?: IrOpts) => setEstado({ seccion, fichaId: opts?.fichaId ?? null }), []);
  const limpiarConsulta = useCallback(() => {}, []);
  const consulta = useMemo(() => new URLSearchParams(), []);
  const value = useMemo<NavAdmin>(() => ({ ...estado, consulta, ir, limpiarConsulta }), [estado, consulta, ir, limpiarConsulta]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function NavAdminProvider({ aislado, children }: { aislado: boolean; children: React.ReactNode }) {
  return aislado ? <ProveedorAislado>{children}</ProveedorAislado> : <ProveedorUrl>{children}</ProveedorUrl>;
}
