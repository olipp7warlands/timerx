import type { SeccionAdmin } from '@/components/admin/types';
import type { Tab } from '@/components/empleado/types';

/** Única definición de las URLs de la app -- la usan las pages (servidor) y los shells (cliente). */

export const TABS_EMPLEADO: Tab[] = ['inicio', 'imputar', 'calendario'];
export const BASE_EMPLEADO = '/inicio';

export function parseRutaEmpleado(segmentos: string[]): Tab | null {
  if (segmentos.length !== 1) return null;
  return TABS_EMPLEADO.find((t) => t === segmentos[0]) ?? null;
}

// Record<SeccionAdmin, …>: si se añade una sección al tipo, el compilador exige decidir su ruta aquí.
const SECCIONES: Record<SeccionAdmin, { ficha: boolean }> = {
  inicio: { ficha: false },
  usuarios: { ficha: true },
  ausencias: { ficha: false },
  empresas: { ficha: true },
  proyectos: { ficha: true },
  categorias: { ficha: false },
  calendario: { ficha: false },
  mapa: { ficha: false },
  control: { ficha: false },
  tarifas: { ficha: false },
  refacturacion: { ficha: false },
  ajustes: { ficha: false },
};

export const BASE_ADMIN = '/admin/inicio';

export interface RutaAdmin {
  seccion: SeccionAdmin;
  fichaId: string | null;
}

/** Segmentos tras `/admin`. `null` = ruta desconocida (el llamador redirige a la base del lado). */
export function parseRutaAdmin(segmentos: string[]): RutaAdmin | null {
  const [seccion, fichaId, ...resto] = segmentos;
  if (!seccion || resto.length > 0 || !(seccion in SECCIONES)) return null;
  const s = seccion as SeccionAdmin;
  if (fichaId !== undefined && !SECCIONES[s].ficha) return null;
  return { seccion: s, fichaId: fichaId ?? null };
}

export function urlAdmin(seccion: SeccionAdmin, opts?: { fichaId?: string; query?: Record<string, string> }): string {
  const base = `/admin/${seccion}${opts?.fichaId ? `/${encodeURIComponent(opts.fichaId)}` : ''}`;
  const qs = opts?.query ? new URLSearchParams(opts.query).toString() : '';
  return qs ? `${base}?${qs}` : base;
}
