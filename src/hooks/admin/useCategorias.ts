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
  subcategorias: Subcategoria[];
}

/** categoria_select/subcategoria_select son abiertas; la escritura es solo admin_grupo. */
export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('categoria')
      .select('id, nombre, activa, subcategoria(id, nombre, activa)')
      .order('nombre');
    setCategorias(
      (data ?? []).map((f: any) => ({
        id: f.id,
        nombre: f.nombre,
        activa: f.activa,
        subcategorias: (f.subcategoria ?? []).sort((a: Subcategoria, b: Subcategoria) => a.nombre.localeCompare(b.nombre)),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crearCategoria = useCallback(
    async (nombre: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('categoria').insert({ nombre });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const crearSubcategoria = useCallback(
    async (categoriaId: string, nombre: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('subcategoria').insert({ categoria_id: categoriaId, nombre });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { categorias, loading, recargar, crearCategoria, crearSubcategoria };
}
