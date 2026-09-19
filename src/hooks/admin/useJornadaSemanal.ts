'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Índice 0..6 = lunes..domingo (dia_semana ISO 1..7). */
const PLANA_VACIA = [0, 0, 0, 0, 0, 0, 0];

async function leerJornada(empresaId: string): Promise<number[]> {
  const { data } = await createClient().from('empresa_jornada').select('dia_semana, horas').eq('empresa_id', empresaId);
  const semana = [...PLANA_VACIA];
  for (const f of data ?? []) semana[f.dia_semana - 1] = Number(f.horas);
  return semana;
}

/**
 * Jornada semanal de UNA empresa (`empresa_jornada`, 019): horas de cada día de la semana. Un día con 0 h no es
 * laborable y las requeridas del mes suman la jornada de cada día laborable. Lectura abierta; la escritura la
 * limita la RLS a admin_grupo (la UI además oculta el botón al resto).
 */
export function useJornadaSemanal(empresaId: string | null) {
  // Lo cargado va etiquetado con SU empresa: `horas` y `loading` se derivan, sin setState síncrono en el efecto.
  const [cargado, setCargado] = useState<{ empresaId: string; semana: number[] } | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    leerJornada(empresaId).then((semana) => {
      if (vigente) setCargado({ empresaId, semana });
    });
    return () => {
      vigente = false;
    };
  }, [empresaId]);

  const vigente = cargado !== null && cargado.empresaId === empresaId;
  const horas = vigente ? cargado.semana : PLANA_VACIA;
  const loading = empresaId !== null && !vigente;

  const recargar = useCallback(async () => {
    if (empresaId) setCargado({ empresaId, semana: await leerJornada(empresaId) });
  }, [empresaId]);

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
