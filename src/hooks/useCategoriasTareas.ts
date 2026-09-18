'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface GrupoTareas {
  categoriaId: string;
  categoriaNombre: string;
  subcategorias: { id: string; nombre: string }[];
}

/**
 * Catálogo completo de categorías/subcategorías activas (las 4 reales, no el subconjunto de los mocks).
 * `departamentoId`: acota a globales (categoria.departamento_id NULL) + las del propio departamento.
 * Sin departamento (null/undefined), se ven todas -- comportamiento previo, sin cambios.
 */
export function useCategoriasTareas(departamentoId?: string | null) {
  const [grupos, setGrupos] = useState<GrupoTareas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('subcategoria')
        .select('id, nombre, categoria_id, categoria:categoria_id(id, nombre, departamento_id)')
        .eq('activa', true)
        .order('nombre');

      if (cancelado) return;
      const porCategoria = new Map<string, GrupoTareas>();
      for (const s of data ?? []) {
        const cat = (s as any).categoria;
        if (!cat) continue;
        if (departamentoId && cat.departamento_id && cat.departamento_id !== departamentoId) continue;
        if (!porCategoria.has(cat.id)) {
          porCategoria.set(cat.id, { categoriaId: cat.id, categoriaNombre: cat.nombre, subcategorias: [] });
        }
        porCategoria.get(cat.id)!.subcategorias.push({ id: s.id, nombre: s.nombre });
      }
      setGrupos([...porCategoria.values()].sort((a, b) => a.categoriaNombre.localeCompare(b.categoriaNombre)));
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [departamentoId]);

  return { grupos, loading };
}
