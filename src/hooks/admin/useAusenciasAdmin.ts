'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AusenciaAdmin {
  id: string;
  perfilId: string;
  nombre: string;
  departamento: string | null;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  comentario: string | null;
}

const SELECT = `
  id, perfil_id, tipo, fecha_inicio, fecha_fin, estado, comentario,
  perfil:perfil_id(nombre, departamento:departamento_id(nombre))
`;

/** Bandeja de ausencias (ausencia + perfil, ya acotada por ausencia_select). aprobar_ausencia() borra borradores solapados. */
export function useAusenciasAdmin() {
  const [ausencias, setAusencias] = useState<AusenciaAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('ausencia').select(SELECT).order('fecha_inicio', { ascending: false });
    setAusencias(
      (data ?? []).map((f: any) => ({
        id: f.id,
        perfilId: f.perfil_id,
        nombre: f.perfil?.nombre ?? '',
        departamento: f.perfil?.departamento?.nombre ?? null,
        tipo: f.tipo,
        fechaInicio: f.fecha_inicio,
        fechaFin: f.fecha_fin,
        estado: f.estado,
        comentario: f.comentario,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const aprobar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('aprobar_ausencia', { p_id: id });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const rechazar = useCallback(
    async (id: string, motivo: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('rechazar_ausencia', { p_id: id, p_motivo: motivo });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { ausencias, loading, recargar, aprobar, rechazar };
}
