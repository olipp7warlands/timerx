'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Ausencia {
  id: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  comentario: string | null;
}

function mensajeError(error: { message: string } | null): string | null {
  return error ? error.message : null;
}

export function useAusenciasMes(anio: number, mes: number) {
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);

    const { data } = await supabase
      .from('ausencia')
      .select('id, tipo, fecha_inicio, fecha_fin, estado, comentario')
      .eq('perfil_id', user.id)
      .lte('fecha_inicio', hasta)
      .gte('fecha_fin', desde)
      .order('fecha_inicio', { ascending: false });

    setAusencias(
      (data ?? []).map((a) => ({
        id: a.id,
        tipo: a.tipo,
        fechaInicio: a.fecha_inicio,
        fechaFin: a.fecha_fin,
        estado: a.estado,
        comentario: a.comentario,
      }))
    );
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const solicitar = useCallback(
    async (tipo: 'vacaciones' | 'baja_medica' | 'otro_permiso', inicio: string, fin: string, comentario?: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('solicitar_ausencia', {
        p_tipo: tipo,
        p_inicio: inicio,
        p_fin: fin,
        p_comentario: comentario,
      });
      if (!error) await recargar();
      return { error: mensajeError(error) };
    },
    [recargar]
  );

  const cancelar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('cancelar_ausencia', { p_id: id });
      if (!error) await recargar();
      return { error: mensajeError(error) };
    },
    [recargar]
  );

  return { ausencias, loading, solicitar, cancelar, recargar };
}
