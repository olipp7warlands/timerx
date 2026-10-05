'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { repartirTareas, type CategoriaCatalogo } from '@/lib/horas/tareas';
import { cargarCatalogo, cargarDepartamentosVisibles } from '@/lib/horas/visibles';

export type { GrupoTareas } from '@/lib/horas/tareas';

/**
 * Especialidades que la persona que imputa puede elegir (regla única de `repartirTareas`, v2.0): las de los departamentos de su
 * empresa o el conjunto exacto que su admin le haya fijado. Sin persona (p. ej. la página de depuración) se ve todo.
 * `sinDepartamentos` = la persona no tiene NINGÚN departamento disponible (su empresa no tiene y no se le fijó ninguno): la UI lo
 * explica en vez de mostrar un selector vacío sin motivo.
 */
export function useEspecialidadesVisibles(persona?: { perfilId: string; empresaId: string }) {
  const [catalogo, setCatalogo] = useState<CategoriaCatalogo[]>([]);
  const [visibles, setVisibles] = useState<Set<string> | null>(null);
  const [propio, setPropio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const perfilId = persona?.perfilId;
  const empresaId = persona?.empresaId;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const [cat, vis, yo] = await Promise.all([
        cargarCatalogo(supabase),
        perfilId && empresaId ? cargarDepartamentosVisibles(supabase, perfilId, empresaId) : Promise.resolve(null),
        perfilId ? supabase.from('perfil').select('departamento_id').eq('id', perfilId).maybeSingle() : Promise.resolve(null),
      ]);
      if (cancelado) return;
      setCatalogo(cat);
      setVisibles(vis);
      setPropio(yo?.data?.departamento_id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [perfilId, empresaId]);

  const grupos = useMemo(() => repartirTareas(catalogo, visibles, propio), [catalogo, visibles, propio]);
  return { grupos, loading, sinDepartamentos: !loading && visibles !== null && visibles.size === 0 };
}
