'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { construirDiasMes, type DiaMes } from '@/lib/horas/calendario';

/** Días del mes con flag laborable (isodow<=5 y sin festivo propio/de grupo), réplica de es_laborable(). */
export function useDiasMes(anio: number, mes: number, empresaId: string | undefined) {
  const [dias, setDias] = useState<DiaMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);

      const { data } = await supabase
        .from('festivo')
        .select('fecha, empresa_id')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`);

      if (cancelado) return;
      const fechasFestivo = new Set((data ?? []).map((f) => f.fecha));
      setDias(construirDiasMes(anio, mes, fechasFestivo));
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [anio, mes, empresaId]);

  return { dias, loading };
}
