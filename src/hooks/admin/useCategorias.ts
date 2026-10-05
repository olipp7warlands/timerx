'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Subcategoria {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  activa: boolean;
  departamentoId: string | null;
  subcategorias: Subcategoria[];
}

/**
 * Catálogo de categorías (= ESPEJO de cada departamento, v2.0) con sus especialidades. SOLO LECTURA: lo usan Tarifas (la clave del dinero
 * es la categoría espejo) y la imputación directa. La gestión de departamentos y especialidades vive en `useDepartamentosAdmin`.
 * categoria_select/subcategoria_select son abiertas; la escritura es solo admin_grupo.
 */
export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('categoria')
      .select('id, nombre, activa, departamento_id, subcategoria(id, nombre, activa)')
      .order('nombre');
    setCategorias(
      (data ?? []).map((f: any) => ({
        id: f.id,
        nombre: f.nombre,
        activa: f.activa,
        departamentoId: f.departamento_id,
        subcategorias: (f.subcategoria ?? []).sort((a: Subcategoria, b: Subcategoria) => a.nombre.localeCompare(b.nombre)),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { categorias, loading, recargar };
}
