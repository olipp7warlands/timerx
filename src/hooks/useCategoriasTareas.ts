'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { repartirTareas, type CategoriaCatalogo, type PerfilTareas } from '@/lib/horas/tareas';

export type { GrupoTareas } from '@/lib/horas/tareas';

/**
 * Catálogo de categorías/subcategorías activas (las reales, no el subconjunto de los mocks) repartido para la persona que
 * imputa con la regla única de `repartirTareas`: `grupos` = lo que ve por defecto, `otras` = el resto («Otras tareas…»;
 * vacío si no tiene categoría). Sin perfil (p. ej. la página de depuración) se ve todo en `grupos`.
 * El catálogo se lee UNA vez; cambiar de categoría/departamento solo recalcula el reparto.
 */
export function useCategoriasTareas(perfil: PerfilTareas = {}) {
  const [catalogo, setCatalogo] = useState<CategoriaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from('subcategoria')
        .select('id, nombre, categoria_id, categoria:categoria_id(id, nombre, departamento_id)')
        .eq('activa', true)
        .order('nombre');

      if (cancelado) return;
      const porCategoria = new Map<string, CategoriaCatalogo>();
      for (const s of data ?? []) {
        const cat = s.categoria;
        if (!cat) continue;
        if (!porCategoria.has(cat.id)) {
          porCategoria.set(cat.id, { categoriaId: cat.id, categoriaNombre: cat.nombre, departamentoId: cat.departamento_id, subcategorias: [] });
        }
        porCategoria.get(cat.id)!.subcategorias.push({ id: s.id, nombre: s.nombre });
      }
      setCatalogo([...porCategoria.values()]);
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const { categoriaId, departamentoId } = perfil;
  const reparto = useMemo(() => repartirTareas(catalogo, { categoriaId, departamentoId }), [catalogo, categoriaId, departamentoId]);

  return { grupos: reparto.grupos, otras: reparto.otras, loading };
}
