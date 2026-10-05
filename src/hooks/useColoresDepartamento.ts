'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { colorDeClave } from '@/lib/horas/colores-departamento';

/**
 * Color de un departamento por NOMBRE (las líneas de imputación, tarifas y refacturación llevan el nombre del departamento: el de su
 * categoría espejo, que el trigger mantiene idéntico). Una sola lectura por carga de página; la sección Departamentos la invalida
 * al cambiar un color o un nombre.
 */
let cache: Promise<Map<string, string | null>> | null = null;

function cargar(): Promise<Map<string, string | null>> {
  cache ??= (async () => {
    const { data } = await createClient().from('departamento').select('nombre, color');
    return new Map((data ?? []).map((d) => [String(d.nombre).toLowerCase(), d.color as string | null]));
  })();
  return cache;
}

export function invalidarColoresDepartamento() {
  cache = null;
}

/** Devuelve `colorDe(nombre)` → `var(--dep-…)` (gris mientras carga o si el departamento no tiene color). */
export function useColoresDepartamento(): (nombre: string | null | undefined) => string {
  const [mapa, setMapa] = useState<Map<string, string | null> | null>(null);
  useEffect(() => {
    let vivo = true;
    cargar().then((m) => {
      if (vivo) setMapa(m);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return useCallback((nombre) => colorDeClave(nombre ? mapa?.get(nombre.toLowerCase()) ?? null : null), [mapa]);
}
