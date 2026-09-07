'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LineaRefacturacion {
  empresaOrigenId: string;
  empresaOrigen: string;
  empresaDestinoId: string;
  empresaDestino: string;
  categoriaId: string;
  categoria: string;
  horas: number;
  importe: number;
  tarifaCompleta: boolean;
}

/** v_refacturacion_mensual (ya con security_invoker=true desde 006) + cierre de mes. */
export function useRefacturacion(anio: number, mes: number) {
  const [lineas, setLineas] = useState<LineaRefacturacion[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('v_refacturacion_mensual')
      .select('empresa_origen_id, empresa_origen, empresa_destino_id, empresa_destino, categoria_id, categoria, horas, importe, tarifa_completa')
      .eq('anio', anio)
      .eq('mes', mes);

    setLineas(
      (data ?? []).map((f: any) => ({
        empresaOrigenId: f.empresa_origen_id,
        empresaOrigen: f.empresa_origen,
        empresaDestinoId: f.empresa_destino_id,
        empresaDestino: f.empresa_destino,
        categoriaId: f.categoria_id,
        categoria: f.categoria,
        horas: Number(f.horas),
        importe: Number(f.importe),
        tarifaCompleta: f.tarifa_completa,
      }))
    );
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  /** El mensaje de error del RPC (desglose de horas sin tarifa, pendientes, etc.) llega verbatim para el Toast. */
  const cerrarPeriodo = useCallback(async (empresaId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('cerrar_periodo', { p_empresa: empresaId, p_anio: anio, p_mes: mes });
    return { error: error?.message ?? null };
  }, [anio, mes]);

  return { lineas, loading, recargar, cerrarPeriodo };
}
