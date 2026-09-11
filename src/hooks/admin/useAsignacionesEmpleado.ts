'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AsignacionEmpleado {
  proyectoId: string;
  proyectoNombre: string;
  empresaNombre: string;
  desde: string;
  hasta: string | null;
}

/**
 * Asignaciones (empleado_proyecto) de un empleado concreto -- acota el
 * selector de proyecto de "Imputación directa" (proyectoIdsParaFecha) y
 * alimenta la sección "Proyectos asignados" de la ficha de usuario
 * (asignaciones, con nombre/empresa y recargar tras asignar/finalizar).
 * ep_select ya permite a admin_grupo/admin_empresa leer las de cualquier
 * empleado en su ámbito.
 */
export function useAsignacionesEmpleado(empleadoId: string) {
  const [asignaciones, setAsignaciones] = useState<AsignacionEmpleado[]>([]);
  const [loading, setLoading] = useState(false);

  const recargar = useCallback(async () => {
    if (!empleadoId) {
      setAsignaciones([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('empleado_proyecto')
      .select('proyecto_id, desde, hasta, proyecto:proyecto_id(nombre, empresa:empresa_id(nombre))')
      .eq('empleado_id', empleadoId)
      .order('desde', { ascending: false });
    setAsignaciones(
      (data ?? []).map((a: any) => ({
        proyectoId: a.proyecto_id,
        proyectoNombre: a.proyecto?.nombre ?? '',
        empresaNombre: a.proyecto?.empresa?.nombre ?? '',
        desde: a.desde,
        hasta: a.hasta,
      }))
    );
    setLoading(false);
  }, [empleadoId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  /** Sin fecha, todos los asignados sin filtrar por vigencia (el form permite elegir empleado antes que fecha). */
  const proyectoIdsParaFecha = useCallback(
    (fecha: string): string[] => {
      if (!fecha) return asignaciones.map((a) => a.proyectoId);
      return asignaciones.filter((a) => a.desde <= fecha && (!a.hasta || a.hasta >= fecha)).map((a) => a.proyectoId);
    },
    [asignaciones]
  );

  return { asignaciones, loading, recargar, proyectoIdsParaFecha };
}
