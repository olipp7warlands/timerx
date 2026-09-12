'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Empresa {
  id: string;
  nombre: string;
  cif: string | null;
  activa: boolean;
}

/** empresa_select es abierto; empresa_admin (escritura) es solo admin_grupo -- la UI debe ocultar el alta a admin_empresa. */
export function useEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('empresa').select('id, nombre, cif, activa').order('nombre');
    setEmpresas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(
    async (nombre: string, cif: string | null) => {
      const supabase = createClient();
      const { error } = await supabase.from('empresa').insert({ nombre, cif });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  /** empresa_admin (escritura) es admin_grupo-only, sin excepción de "empresa propia" -- la UI oculta estas acciones para admin_empresa siempre. */
  const actualizar = useCallback(
    async (id: string, input: { nombre: string; cif: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.from('empresa').update({ nombre: input.nombre, cif: input.cif }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  /** Mutación pura, sin guard -- el guard (cero proyectos activos, cero empleados activos) vive en el componente, que ya tiene esas listas cargadas. */
  const desactivar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('empresa').update({ activa: false }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { empresas, loading, recargar, crear, actualizar, desactivar };
}
