'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ItemMapa {
  id: string;
  nombre: string;
  etiqueta: string | null;
  descripcion: string;
  empresaNombre: string | null;
  url: string | null;
}

export interface AreaMapa {
  id: string;
  nombre: string;
  color: string;
  items: ItemMapa[];
}

export const DESCRIPCION_AUTO = 'Proyecto activo — aparece automáticamente por su tipología.';

const normalizar = (nombre: string) => nombre.trim().toLocaleLowerCase('es');

/**
 * Capa AUTOMÁTICA del mapa (Lote 4): los proyectos ACTIVOS con tipología aparecen bajo su área, DESPUÉS de los elementos
 * manuales, con la etiqueta AUTO. Regla de deduplicación del mock: si el área ya tiene un elemento manual con el mismo
 * nombre, el automático NO se pinta (el curado manual manda). Es composición en lectura: sin tabla nueva.
 */
function elementosAuto(proyectos: { id: string; nombre: string; empresaNombre: string | null }[], manuales: ItemMapa[]): ItemMapa[] {
  const yaCurados = new Set(manuales.map((i) => normalizar(i.nombre)));
  return proyectos
    .filter((p) => !yaCurados.has(normalizar(p.nombre)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((p) => ({
      id: `auto-${p.id}`,
      nombre: p.nombre,
      etiqueta: 'AUTO',
      descripcion: DESCRIPCION_AUTO,
      empresaNombre: p.empresaNombre,
      url: null,
    }));
}

/** Mapa del grupo: lectura para todo authenticated (mapa_area_select/mapa_item_select/proyecto_select). */
export function useMapa() {
  const [areas, setAreas] = useState<AreaMapa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const [{ data }, { data: proyectos }] = await Promise.all([
        supabase
          .from('mapa_area')
          .select('id, nombre, color, orden, activa, mapa_item(id, nombre, etiqueta, descripcion, orden, activo, url, empresa:empresa_id(nombre))')
          .eq('activa', true)
          .order('orden'),
        supabase.from('proyecto').select('id, nombre, area_id, empresa:empresa_id(nombre)').eq('activo', true).not('area_id', 'is', null),
      ]);

      if (cancelado) return;
      const resultado: AreaMapa[] = (data ?? []).map((a: any) => {
        const manuales: ItemMapa[] = (a.mapa_item ?? [])
          .filter((i: any) => i.activo)
          .sort((x: any, y: any) => x.orden - y.orden)
          .map((i: any) => ({
            id: i.id,
            nombre: i.nombre,
            etiqueta: i.etiqueta,
            descripcion: i.descripcion,
            empresaNombre: i.empresa?.nombre ?? null,
            url: i.url,
          }));
        const delArea = (proyectos ?? [])
          .filter((p) => p.area_id === a.id)
          .map((p) => ({ id: p.id, nombre: p.nombre, empresaNombre: p.empresa?.nombre ?? null }));
        return { id: a.id, nombre: a.nombre, color: a.color, items: [...manuales, ...elementosAuto(delArea, manuales)] };
      });
      setAreas(resultado);
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { areas, loading };
}
