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

/** Mapa del grupo: lectura para todo authenticated (mapa_area_select/mapa_item_select). */
export function useMapa() {
  const [areas, setAreas] = useState<AreaMapa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('mapa_area')
        .select('id, nombre, color, orden, activa, mapa_item(id, nombre, etiqueta, descripcion, orden, activo, url, empresa:empresa_id(nombre))')
        .eq('activa', true)
        .order('orden');

      if (cancelado) return;
      const resultado: AreaMapa[] = (data ?? []).map((a: any) => ({
        id: a.id,
        nombre: a.nombre,
        color: a.color,
        items: (a.mapa_item ?? [])
          .filter((i: any) => i.activo)
          .sort((x: any, y: any) => x.orden - y.orden)
          .map((i: any) => ({
            id: i.id,
            nombre: i.nombre,
            etiqueta: i.etiqueta,
            descripcion: i.descripcion,
            empresaNombre: i.empresa?.nombre ?? null,
            url: i.url,
          })),
      }));
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
