'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ProyectoAdmin {
  id: string;
  codigo: string;
  nombre: string;
  empresaId: string;
  empresaNombre: string;
  activo: boolean;
}

/**
 * NOTA: el mock (panel_administracion.html) pide un campo "Cliente" en el alta de
 * proyecto, pero la tabla `proyecto` (001) no tiene esa columna -- no se inventa,
 * se omite del formulario hasta que el esquema la incorpore si hace falta.
 */
export interface NuevoProyecto {
  empresaId: string;
  codigo: string;
  nombre: string;
}

/** proyecto_select es abierto; proyecto_admin (escritura) acota admin_empresa a su propia empresa. */
export function useProyectosAdmin() {
  const [proyectos, setProyectos] = useState<ProyectoAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('proyecto').select('id, codigo, nombre, empresa_id, activo, empresa:empresa_id(nombre)').order('nombre');
    setProyectos(
      (data ?? []).map((f: any) => ({
        id: f.id,
        codigo: f.codigo,
        nombre: f.nombre,
        empresaId: f.empresa_id,
        empresaNombre: f.empresa?.nombre ?? '',
        activo: f.activo,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(
    async (nuevo: NuevoProyecto) => {
      const supabase = createClient();
      const { error } = await supabase.from('proyecto').insert({ empresa_id: nuevo.empresaId, codigo: nuevo.codigo, nombre: nuevo.nombre });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { proyectos, loading, recargar, crear };
}
