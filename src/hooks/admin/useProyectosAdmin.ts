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
  /** Tipología propia del proyecto (área del mapa, 020); null = sin tipología. Copia hecha al crear, no referencia viva a la empresa. */
  areaId: string | null;
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
  /** Ya resuelto por la UI: si eligió "Heredar de la empresa", aquí va el área de la empresa en ese momento (copia). */
  areaId: string | null;
}

/** proyecto_select es abierto; proyecto_admin (escritura) acota admin_empresa a su propia empresa. */
export function useProyectosAdmin() {
  const [proyectos, setProyectos] = useState<ProyectoAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('proyecto').select('id, codigo, nombre, empresa_id, activo, area_id, empresa:empresa_id(nombre)').order('nombre');
    setProyectos(
      (data ?? []).map((f: any) => ({
        id: f.id,
        codigo: f.codigo,
        nombre: f.nombre,
        empresaId: f.empresa_id,
        empresaNombre: f.empresa?.nombre ?? '',
        activo: f.activo,
        areaId: f.area_id ?? null,
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
      const { error } = await supabase.from('proyecto').insert({ empresa_id: nuevo.empresaId, codigo: nuevo.codigo, nombre: nuevo.nombre, area_id: nuevo.areaId });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  /** Cambia la tipología de un proyecto ya creado (la RLS de `proyecto_admin` acota a admin_grupo / admin_empresa de su empresa). */
  const cambiarTipologia = useCallback(
    async (id: string, areaId: string | null) => {
      const supabase = createClient();
      const { error } = await supabase.from('proyecto').update({ area_id: areaId }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { proyectos, loading, recargar, crear, cambiarTipologia };
}
