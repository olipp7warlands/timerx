'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ImputacionPendiente {
  id: string;
  empleadoNombre: string;
  proyectoNombre: string;
  empresaDestino: string;
  fecha: string;
  horas: number;
}

const SELECT = `
  id, fecha, horas,
  empleado:empleado_id(nombre),
  proyecto:proyecto_id(nombre, empresa:empresa_id(nombre))
`;

/** Bandeja de imputaciones enviadas (imputacion_select ya acota admin_grupo/admin_empresa-destino). */
export function useAprobacionImputaciones() {
  const [pendientes, setPendientes] = useState<ImputacionPendiente[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('imputacion').select(SELECT).eq('estado', 'enviada').order('fecha', { ascending: false });
    setPendientes(
      (data ?? []).map((f: any) => ({
        id: f.id,
        empleadoNombre: f.empleado?.nombre ?? '',
        proyectoNombre: f.proyecto?.nombre ?? '',
        empresaDestino: f.proyecto?.empresa?.nombre ?? '',
        fecha: f.fecha,
        horas: Number(f.horas),
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
      const { error } = await supabase.rpc('aprobar_imputaciones', { p_ids: [id] });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const rechazar = useCallback(
    async (id: string, motivo: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('rechazar_imputaciones', { p_ids: [id], p_motivo: motivo });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { pendientes, loading, recargar, aprobar, rechazar };
}
