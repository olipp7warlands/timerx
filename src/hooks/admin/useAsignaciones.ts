'use client';

import { hoyMadrid } from '@/lib/fechas';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resultadoMutacion } from '@/lib/supabase/mutaciones';

/**
 * Mutaciones de empleado_proyecto compartidas entre la ficha de usuario y la
 * ficha de proyecto -- una sola implementación para las dos superficies. La
 * PK de empleado_proyecto es (empleado_id, proyecto_id): reasignar a alguien
 * que ya estuvo (y fue finalizado) antes es un upsert, nunca un insert nuevo
 * que chocaría con la fila existente. "Finalizar" es siempre update
 * hasta=hoy, nunca delete -- la vigencia es historial que los selectores de
 * imputación ya respetan.
 */
export function useAsignaciones() {
  const asignar = useCallback(async (empleadoId: string, proyectoId: string) => {
    const supabase = createClient();
    const hoy = hoyMadrid();
    const { error } = await supabase
      .from('empleado_proyecto')
      .upsert({ empleado_id: empleadoId, proyecto_id: proyectoId, desde: hoy, hasta: null }, { onConflict: 'empleado_id,proyecto_id' });
    return { error: error?.message ?? null };
  }, []);

  const finalizar = useCallback(async (empleadoId: string, proyectoId: string) => {
    const supabase = createClient();
    const hoy = hoyMadrid();
    const { data, error } = await supabase.from('empleado_proyecto').update({ hasta: hoy }).eq('empleado_id', empleadoId).eq('proyecto_id', proyectoId).select('empleado_id');
    // RLS (ep_admin) acota admin_empresa a proyectos de su empresa: fuera de ámbito da 0 filas, no error.
    return resultadoMutacion(error, data, 'No se pudo finalizar la asignación: el proyecto no es de tu empresa o ya no existe.');
  }, []);

  return { asignar, finalizar };
}

export interface AsignacionProyectoPersona {
  empleadoId: string;
  nombre: string;
  departamento: string | null;
  categoriaNombre: string | null;
  desde: string;
  hasta: string | null;
}

/** Personas asignadas a un proyecto concreto -- para la columna de acciones + "＋ Añadir persona" de la ficha de proyecto. */
export function useAsignacionesProyecto(proyectoId: string | null) {
  const [asignaciones, setAsignaciones] = useState<AsignacionProyectoPersona[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    if (!proyectoId) {
      setAsignaciones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('empleado_proyecto')
      .select('empleado_id, desde, hasta, empleado:empleado_id(nombre, departamento:departamento_id(nombre), categoria:categoria_id(nombre))')
      .eq('proyecto_id', proyectoId);
    setAsignaciones(
      (data ?? []).map((a: any) => ({
        empleadoId: a.empleado_id,
        nombre: a.empleado?.nombre ?? '',
        departamento: a.empleado?.departamento?.nombre ?? null,
        categoriaNombre: a.empleado?.categoria?.nombre ?? null,
        desde: a.desde,
        hasta: a.hasta,
      }))
    );
    setLoading(false);
  }, [proyectoId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { asignaciones, loading, recargar };
}
