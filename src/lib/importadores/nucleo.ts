import type { SupabaseClient } from '@supabase/supabase-js';
import { getPerfilActivoServer as getPerfilServer } from '@/lib/supabase/perfil';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { generarPlantilla, leerXlsx, type DefinicionPlantilla, type FilaLeida } from './xlsx';
import type { ErrorFila, InformeImportacion, TipoImportacion } from './tipos';

/**
 * Patrón común de los tres importadores (usuarios, coste/hora, vacaciones):
 *   subir archivo -> ANÁLISIS EN SECO con informe -> importar solo con CERO errores (todo-o-nada).
 * Cada importador solo aporta su plantilla, sus reglas de análisis y su mutación.
 */
export interface ContextoImportacion {
  /** Sesión REAL del admin: toda lectura/escritura respeta RLS. */
  supabase: SupabaseClient;
  adminId: string;
}

export interface Definicion<TFila> {
  id: TipoImportacion;
  plantilla: DefinicionPlantilla;
  /** Columnas toleradas que NO se importan (p. ej. `activo` del export de usuarios: permite reimportar el mismo archivo). */
  ignoradas?: string[];
  analizar(ctx: ContextoImportacion, filas: FilaLeida[]): Promise<{ validas: TFila[]; errores: ErrorFila[] }>;
  /** Todo-o-nada: si falla, no puede quedar nada a medias. */
  ejecutar(ctx: ContextoImportacion, validas: TFila[]): Promise<{ error: string | null }>;
}

/** Definición con el tipo de fila borrado: lo que ve el registro y `procesar` (cada importador conserva su tipo de fila dentro). */
export interface Importador {
  id: TipoImportacion;
  plantilla: DefinicionPlantilla;
  ignoradas?: string[];
  correr(ctx: ContextoImportacion, filas: FilaLeida[], ejecutar: boolean): Promise<{ validas: number; errores: ErrorFila[]; error: string | null }>;
}

export function definir<TFila>(def: Definicion<TFila>): Importador {
  return {
    id: def.id,
    plantilla: def.plantilla,
    ignoradas: def.ignoradas,
    async correr(ctx, filas, ejecutar) {
      const { validas, errores } = await def.analizar(ctx, filas);
      errores.sort((a, b) => a.fila - b.fila);
      if (!ejecutar || errores.length > 0) return { validas: validas.length, errores, error: null };
      const { error } = await def.ejecutar(ctx, validas);
      return { validas: validas.length, errores, error };
    },
  };
}

const MAX_BYTES = 2 * 1024 * 1024;

/** Guard de servidor (la UI oculta las tarjetas, pero la barrera real es esta): solo admin_grupo. */
export async function contextoAdminGrupo(): Promise<{ ok: true; ctx: ContextoImportacion } | { ok: false; error: string }> {
  const perfil = await getPerfilServer();
  if (!perfil || perfil.rol !== 'admin_grupo') {
    return { ok: false, error: 'Las importaciones masivas son solo para el admin del grupo.' };
  }
  return { ok: true, ctx: { supabase: await createSessionClient(), adminId: perfil.id } };
}

export async function plantillaDe(def: Importador): Promise<Buffer> {
  return generarPlantilla(def.plantilla);
}

/**
 * Análisis en seco y, solo si `ejecutar` y CERO errores, importación. El archivo se re-parsea y re-analiza
 * en cada llamada: el servidor nunca se fía de un análisis previo del cliente.
 */
export async function procesar(def: Importador, archivo: File | null, ejecutar: boolean): Promise<InformeImportacion> {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!archivo || archivo.size === 0) return { ok: false, error: 'Selecciona un archivo .xlsx.' };
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) return { ok: false, error: 'El archivo debe ser un .xlsx (Excel).' };
  if (archivo.size > MAX_BYTES) return { ok: false, error: 'El archivo supera el máximo de 2 MB.' };

  const obligatorias = def.plantilla.columnas.filter((c) => c.obligatoria).map((c) => c.cabecera);
  const opcionales = [...def.plantilla.columnas.filter((c) => !c.obligatoria).map((c) => c.cabecera), ...(def.ignoradas ?? [])];
  const leido = await leerXlsx(Buffer.from(await archivo.arrayBuffer()), obligatorias, opcionales);
  if (!leido.ok) return { ok: false, error: leido.error };
  if (leido.filas.length === 0) return { ok: false, error: 'El archivo no contiene ninguna fila de datos (debajo de la cabecera).' };

  const r = await def.correr(guard.ctx, leido.filas, ejecutar);
  if (r.error) return { ok: false, error: r.error };
  const informe = { ok: true as const, totalFilas: leido.filas.length, validas: r.validas, errores: r.errores };
  if (!ejecutar) return informe;
  // Con errores no se importa nada (todo-o-nada): `importadas: 0`.
  return { ...informe, importadas: r.errores.length ? 0 : r.validas };
}

/** Motivos de varias reglas sobre la misma fila -> un único error de fila (el informe dice TODO lo que hay que corregir). */
export function errorDeFila(fila: number, motivos: string[]): ErrorFila | null {
  return motivos.length ? { fila, motivo: motivos.join('; ') } : null;
}

export function claveTexto(t: string): string {
  return t.trim().toLowerCase();
}
