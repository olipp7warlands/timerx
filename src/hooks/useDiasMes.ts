'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiaMes } from '@/lib/horas/calendario';

/**
 * Días del mes con su jornada y si son laborables, servidos por `jornada_dias_mes()` (019): fuente única en BD
 * (jornada semanal por empresa + festivos). Sustituye la réplica en TypeScript de es_laborable(), que tenía el
 * fin de semana cableado y una jornada plana.
 */
export function useDiasMes(anio: number, mes: number, empresaId: string | undefined) {
  const [dias, setDias] = useState<DiaMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const { data } = await createClient().rpc('jornada_dias_mes', { p_anio: anio, p_mes: mes, p_empresa: empresaId! });
      if (cancelado) return;
      setDias(
        (data ?? []).map((d) => {
          const [y, m, dd] = d.fecha.split('-').map(Number);
          return { fecha: d.fecha, dow: new Date(y, m - 1, dd).getDay(), laborable: d.laborable, jornada: Number(d.jornada) };
        })
      );
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [anio, mes, empresaId]);

  return { dias, loading };
}
