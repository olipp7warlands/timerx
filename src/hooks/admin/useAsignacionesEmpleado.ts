'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Asignacion {
  proyectoId: string;
  desde: string;
  hasta: string | null;
}

/**
 * Asignaciones (empleado_proyecto) de un empleado concreto, para acotar el
 * selector de proyecto de "Imputación directa" -- ep_select ya permite a
 * admin_grupo/admin_empresa leer las de cualquier empleado, justo para esto.
 */
export function useAsignacionesEmpleado(empleadoId: string) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empleadoId) {
      setAsignaciones([]);
      return;
    }
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.from('empleado_proyecto').select('proyecto_id, desde, hasta').eq('empleado_id', empleadoId);
      if (cancelado) return;
      setAsignaciones((data ?? []).map((a) => ({ proyectoId: a.proyecto_id, desde: a.desde, hasta: a.hasta })));
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [empleadoId]);

  /** Sin fecha, todos los asignados sin filtrar por vigencia (el form permite elegir empleado antes que fecha). */
  const proyectoIdsParaFecha = useCallback(
    (fecha: string): string[] => {
      if (!fecha) return asignaciones.map((a) => a.proyectoId);
      return asignaciones.filter((a) => a.desde <= fecha && (!a.hasta || a.hasta >= fecha)).map((a) => a.proyectoId);
    },
    [asignaciones]
  );

  return { proyectoIdsParaFecha, loading };
}
