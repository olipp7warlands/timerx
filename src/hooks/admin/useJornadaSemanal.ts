'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Índice 0..6 = lunes..domingo (dia_semana ISO 1..7). */
const PLANA_VACIA = [0, 0, 0, 0, 0, 0, 0];

/**
 * Jornada semanal de UNA empresa (`empresa_jornada`, 019): horas de cada día de la semana. Un día con 0 h no es
 * laborable y las requeridas del mes suman la jornada de cada día laborable. Lectura abierta; la escritura la
 * limita la RLS a admin_grupo (la UI además oculta el botón al resto).
 */
export function useJornadaSemanal(empresaId: string | null) {
  const [horas, setHoras] = useState<number[]>(PLANA_VACIA);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    if (!empresaId) {
      setHoras(PLANA_VACIA);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await createClient().from('empresa_jornada').select('dia_semana, horas').eq('empresa_id', empresaId);
    const semana = [...PLANA_VACIA];
    for (const f of data ?? []) semana[f.dia_semana - 1] = Number(f.horas);
    setHoras(semana);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const guardar = useCallback(
    async (semana: number[]) => {
      if (!empresaId) return { error: 'Sin empresa seleccionada' };
      const { error } = await createClient()
        .from('empresa_jornada')
        .upsert(
          semana.map((h, i) => ({ empresa_id: empresaId, dia_semana: i + 1, horas: h })),
          { onConflict: 'empresa_id,dia_semana' }
        );
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [empresaId, recargar]
  );

  return { horas, loading, guardar, recargar };
}
