'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resultadoMutacion } from '@/lib/supabase/mutaciones';

export interface Empresa {
  id: string;
  nombre: string;
  cif: string | null;
  activa: boolean;
  /** Tipología (área del mapa, 020); null = sin tipología. */
  areaId: string | null;
}

/** empresa_select es abierto; empresa_admin (escritura) es solo admin_grupo -- la UI debe ocultar el alta a admin_empresa. */
export function useEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('empresa').select('id, nombre, cif, activa, area_id').order('nombre');
    setEmpresas((data ?? []).map((f) => ({ id: f.id, nombre: f.nombre, cif: f.cif, activa: f.activa, areaId: f.area_id })));
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(
    async (nombre: string, cif: string | null, areaId: string | null, departamentoIds: string[] = []) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('empresa').insert({ nombre, cif, area_id: areaId }).select('id');
      if (error) return { error: error.message };
      // Departamentos de la empresa (v2.0): se fijan en el alta. Sin ellos, sus profesionales no verían ninguna especialidad.
      if (data?.[0] && departamentoIds.length > 0) {
        const { error: eVinc } = await supabase.from('empresa_departamento').insert(departamentoIds.map((d) => ({ empresa_id: data[0].id, departamento_id: d })));
        if (eVinc) {
          await recargar();
          return { error: `La empresa se creó, pero no se pudieron asignar sus departamentos: ${eVinc.message}` };
        }
      }
      await recargar();
      return { error: null };
    },
    [recargar]
  );

  /** empresa_admin (escritura) es admin_grupo-only, sin excepción de "empresa propia" -- la UI oculta estas acciones para admin_empresa siempre. */
  const actualizar = useCallback(
    async (id: string, input: { nombre: string; cif: string | null; areaId: string | null }) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('empresa').update({ nombre: input.nombre, cif: input.cif, area_id: input.areaId }).eq('id', id).select('id');
      const r = resultadoMutacion(error, data);
      if (!r.error) await recargar();
      return r;
    },
    [recargar]
  );

  /** Mutación pura, sin guard -- el guard (cero proyectos activos, cero empleados activos) vive en el componente, que ya tiene esas listas cargadas. */
  const desactivar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('empresa').update({ activa: false }).eq('id', id).select('id');
      const r = resultadoMutacion(error, data);
      if (!r.error) await recargar();
      return r;
    },
    [recargar]
  );

  return { empresas, loading, recargar, crear, actualizar, desactivar };
}
