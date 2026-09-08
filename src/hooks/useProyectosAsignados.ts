'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ProyectoAsignado {
  id: string;
  nombre: string;
  empresaId: string;
  empresaNombre: string;
}

interface AsignacionProyecto extends ProyectoAsignado {
  desde: string;
  hasta: string | null;
}

/**
 * Proyectos del empleado logueado, vía empleado_proyecto. `.eq('empleado_id', ...)`
 * explícito en vez de confiar solo en RLS: ep_select da lectura amplia a
 * admin_grupo/admin_empresa sobre TODO el grupo (a propósito, para futuras
 * pantallas admin) -- si no se acota aquí, un admin ve en su propio selector
 * de imputación asignaciones de otros empleados.
 */
export function useProyectosAsignados() {
  const [asignaciones, setAsignaciones] = useState<AsignacionProyecto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelado) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('empleado_proyecto')
        .select('desde, hasta, proyecto:proyecto_id(id, nombre, empresa_id, empresa:empresa_id(nombre))')
        .eq('empleado_id', user.id);

      if (cancelado) return;
      const lista = (data ?? [])
        .map((ep: any) => (ep.proyecto ? { ...ep.proyecto, desde: ep.desde, hasta: ep.hasta } : null))
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          empresaId: p.empresa_id,
          empresaNombre: p.empresa?.nombre ?? '',
          desde: p.desde,
          hasta: p.hasta,
        }))
        .sort((a: AsignacionProyecto, b: AsignacionProyecto) => a.nombre.localeCompare(b.nombre));
      setAsignaciones(lista);
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  /** Proyectos cuya asignación cubre TODAS las fechas dadas. `[]` de entrada -> `[]`. */
  const paraFechas = useCallback(
    (fechas: string[]): ProyectoAsignado[] => {
      if (fechas.length === 0) return [];
      return asignaciones
        .filter((a) => fechas.every((f) => a.desde <= f && (!a.hasta || a.hasta >= f)))
        .map(({ id, nombre, empresaId, empresaNombre }) => ({ id, nombre, empresaId, empresaNombre }));
    },
    [asignaciones]
  );

  return { paraFechas, loading };
}
