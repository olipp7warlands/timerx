'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ImputacionDirecta {
  empleadoId: string;
  proyectoId: string;
  subcategoriaId: string;
  fecha: string;
  horas: number;
  descripcion?: string;
}

/** imputar_directo() (006) -- entra como 'aprobada', creada_por queda registrado en servidor. */
export function useImputarDirecto() {
  const imputar = useCallback(async (linea: ImputacionDirecta) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('imputar_directo', {
      p_empleado: linea.empleadoId,
      p_proyecto: linea.proyectoId,
      p_subcategoria: linea.subcategoriaId,
      p_fecha: linea.fecha,
      p_horas: linea.horas,
      p_descripcion: linea.descripcion,
    });
    return { id: data as string | null, error: error?.message ?? null };
  }, []);

  return { imputar };
}
