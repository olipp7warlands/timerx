'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ProyectoAsignado {
  id: string;
  nombre: string;
  empresaId: string;
  empresaNombre: string;
}

/** Proyectos del empleado logueado, vía empleado_proyecto (RLS ep_select ya filtra por auth.uid()). */
export function useProyectosAsignados() {
  const [proyectos, setProyectos] = useState<ProyectoAsignado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('empleado_proyecto')
        .select('proyecto:proyecto_id(id, nombre, empresa_id, empresa:empresa_id(nombre))');

      if (cancelado) return;
      const lista = (data ?? [])
        .map((ep: any) => ep.proyecto)
        .filter(Boolean)
        .map((p: any) => ({ id: p.id, nombre: p.nombre, empresaId: p.empresa_id, empresaNombre: p.empresa?.nombre ?? '' }))
        .sort((a: ProyectoAsignado, b: ProyectoAsignado) => a.nombre.localeCompare(b.nombre));
      setProyectos(lista);
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { proyectos, loading };
}
