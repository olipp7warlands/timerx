'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AreaAdmin {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  itemCount: number;
}

export interface ItemAdmin {
  id: string;
  areaId: string;
  areaNombre: string;
  areaColor: string;
  nombre: string;
  etiqueta: string | null;
  descripcion: string;
  empresaId: string | null;
  empresaNombre: string | null;
  url: string | null;
  orden: number;
}

export interface ItemInput {
  areaId: string;
  nombre: string;
  etiqueta: string | null;
  descripcion: string;
  empresaId: string | null;
  url: string | null;
}

/** mapa_area/mapa_item: lectura abierta, escritura solo admin_grupo (mapa_area_admin/mapa_item_admin). "Eliminar" es baja lógica (activa/activo=false), nunca delete. */
export function useMapaAdmin() {
  const [areas, setAreas] = useState<AreaAdmin[]>([]);
  const [items, setItems] = useState<ItemAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: areasData } = await supabase
      .from('mapa_area')
      .select('id, nombre, color, orden, mapa_item(id, activo)')
      .eq('activa', true)
      .order('orden');
    const areasResult: AreaAdmin[] = (areasData ?? []).map((a: any) => ({
      id: a.id,
      nombre: a.nombre,
      color: a.color,
      orden: a.orden,
      itemCount: (a.mapa_item ?? []).filter((i: any) => i.activo).length,
    }));
    setAreas(areasResult);
    const ordenPorArea = new Map(areasResult.map((a) => [a.id, a.orden]));

    const { data: itemsData } = await supabase
      .from('mapa_item')
      .select('id, area_id, nombre, etiqueta, descripcion, empresa_id, url, orden, activo, area:area_id(nombre, color), empresa:empresa_id(nombre)')
      .eq('activo', true);
    const itemsResult: ItemAdmin[] = (itemsData ?? [])
      .map((i: any) => ({
        id: i.id,
        areaId: i.area_id,
        areaNombre: i.area?.nombre ?? '',
        areaColor: i.area?.color ?? '',
        nombre: i.nombre,
        etiqueta: i.etiqueta,
        descripcion: i.descripcion,
        empresaId: i.empresa_id,
        empresaNombre: i.empresa?.nombre ?? null,
        url: i.url,
        orden: i.orden,
      }))
      .sort((a, b) => (ordenPorArea.get(a.areaId) ?? 0) - (ordenPorArea.get(b.areaId) ?? 0) || a.orden - b.orden);
    setItems(itemsResult);
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crearArea = useCallback(
    async (nombre: string, color: string) => {
      const supabase = createClient();
      const maxOrden = areas.reduce((m, a) => Math.max(m, a.orden), 0);
      const { error } = await supabase.from('mapa_area').insert({ nombre, color, orden: maxOrden + 1 });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [areas, recargar]
  );

  const actualizarArea = useCallback(
    async (id: string, nombre: string, color: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('mapa_area').update({ nombre, color }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const eliminarArea = useCallback(
    async (id: string) => {
      const area = areas.find((a) => a.id === id);
      if (area && area.itemCount > 0) {
        return { error: 'Esta área tiene elementos activos -- elimínalos o muévelos a otra área antes.' };
      }
      const supabase = createClient();
      const { error } = await supabase.from('mapa_area').update({ activa: false }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [areas, recargar]
  );

  const moverArea = useCallback(
    async (id: string, dir: 'up' | 'down') => {
      const idx = areas.findIndex((a) => a.id === id);
      const otroIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || otroIdx < 0 || otroIdx >= areas.length) return;
      const a = areas[idx];
      const b = areas[otroIdx];
      const supabase = createClient();
      await supabase.from('mapa_area').update({ orden: b.orden }).eq('id', a.id);
      await supabase.from('mapa_area').update({ orden: a.orden }).eq('id', b.id);
      await recargar();
    },
    [areas, recargar]
  );

  const crearItem = useCallback(
    async (input: ItemInput) => {
      const supabase = createClient();
      const maxOrden = items.filter((i) => i.areaId === input.areaId).reduce((m, i) => Math.max(m, i.orden), 0);
      const { error } = await supabase.from('mapa_item').insert({
        area_id: input.areaId,
        nombre: input.nombre,
        etiqueta: input.etiqueta || null,
        descripcion: input.descripcion,
        empresa_id: input.empresaId || null,
        url: input.url || null,
        orden: maxOrden + 1,
      });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [items, recargar]
  );

  const actualizarItem = useCallback(
    async (id: string, input: ItemInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('mapa_item')
        .update({
          area_id: input.areaId,
          nombre: input.nombre,
          etiqueta: input.etiqueta || null,
          descripcion: input.descripcion,
          empresa_id: input.empresaId || null,
          url: input.url || null,
        })
        .eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const eliminarItem = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('mapa_item').update({ activo: false }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const moverItem = useCallback(
    async (id: string, dir: 'up' | 'down') => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const mismaArea = items.filter((i) => i.areaId === item.areaId).sort((a, b) => a.orden - b.orden);
      const idx = mismaArea.findIndex((i) => i.id === id);
      const otroIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (otroIdx < 0 || otroIdx >= mismaArea.length) return;
      const a = mismaArea[idx];
      const b = mismaArea[otroIdx];
      const supabase = createClient();
      await supabase.from('mapa_item').update({ orden: b.orden }).eq('id', a.id);
      await supabase.from('mapa_item').update({ orden: a.orden }).eq('id', b.id);
      await recargar();
    },
    [items, recargar]
  );

  return { areas, items, loading, crearArea, actualizarArea, eliminarArea, moverArea, crearItem, actualizarItem, eliminarItem, moverItem };
}
