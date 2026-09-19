'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ImputacionPendiente {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  proyectoNombre: string;
  empresaDestino: string;
  /** Empresa del proyecto: la que APRUEBA (la 001 lo decide por destino, no por origen). */
  empresaDestinoId: string;
  fecha: string;
  horas: number;
}

const SIN_APROBAR = 'No se aprobó nada: la línea ya no está pendiente, o es de un proyecto de otra empresa (la aprueba su empresa destino).';

const SELECT = `
  id, fecha, horas, empleado_id,
  empleado:empleado_id(nombre),
  proyecto:proyecto_id(nombre, empresa_id, empresa:empresa_id(nombre))
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
        empleadoId: f.empleado_id,
        empleadoNombre: f.empleado?.nombre ?? '',
        proyectoNombre: f.proyecto?.nombre ?? '',
        empresaDestino: f.proyecto?.empresa?.nombre ?? '',
        empresaDestinoId: f.proyecto?.empresa_id ?? '',
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
      const { data, error } = await supabase.rpc('aprobar_imputaciones', { p_ids: [id] });
      if (error) return { error: error.message };
      await recargar();
      // La RPC devuelve cuántas líneas ha aprobado y NO lanza si son 0 (ya no estaba enviada, o el proyecto es de otra empresa).
      if (!data) return { error: SIN_APROBAR };
      return { error: null };
    },
    [recargar]
  );

  const rechazar = useCallback(
    async (id: string, motivo: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rechazar_imputaciones', { p_ids: [id], p_motivo: motivo });
      if (error) return { error: error.message };
      await recargar();
      if (!data) return { error: SIN_APROBAR.replace('aprobó', 'rechazó') };
      return { error: null };
    },
    [recargar]
  );

  return { pendientes, loading, recargar, aprobar, rechazar };
}
