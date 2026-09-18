'use server';

import { importadorDe } from '@/lib/importadores/registro';
import { procesar } from '@/lib/importadores/nucleo';
import type { InformeImportacion, TipoImportacion } from '@/lib/importadores/tipos';

/**
 * Los tres importadores comparten esta única pareja de acciones (patrón común): el archivo sube al servidor,
 * exceljs lo parsea allí y el guard admin_grupo se comprueba en `procesar` (además de ocultarse la UI).
 * `analizar` es siempre en seco; `ejecutar` re-analiza y solo importa con CERO errores.
 */
async function ejecutarPaso(tipo: TipoImportacion, formData: FormData, ejecutar: boolean): Promise<InformeImportacion> {
  const def = importadorDe(tipo);
  if (!def) return { ok: false, error: 'Tipo de importación desconocido.' };
  const archivo = formData.get('archivo');
  try {
    return await procesar(def, archivo instanceof File ? archivo : null, ejecutar);
  } catch (e) {
    console.error(`importación ${tipo} (${ejecutar ? 'ejecutar' : 'analizar'}):`, e);
    return { ok: false, error: 'Error inesperado al procesar el archivo. No se ha importado nada.' };
  }
}

export async function analizarImportacion(tipo: TipoImportacion, formData: FormData): Promise<InformeImportacion> {
  return ejecutarPaso(tipo, formData, false);
}

export async function ejecutarImportacion(tipo: TipoImportacion, formData: FormData): Promise<InformeImportacion> {
  return ejecutarPaso(tipo, formData, true);
}
