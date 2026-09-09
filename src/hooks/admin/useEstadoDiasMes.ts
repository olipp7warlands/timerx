'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EstadoDia } from '@/lib/horas/calendario';

/** estado_dias_mes() (011) -- completo/incompleto/futuro/no-laborable real, por fecha ISO. */
export function useEstadoDiasMes(anio: number, mes: number) {
  const [estadoPorFecha, setEstadoPorFecha] = useState<Record<string, EstadoDia>>({});
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('estado_dias_mes', { p_anio: anio, p_mes: mes });
    const mapa: Record<string, EstadoDia> = {};
    for (const fila of data ?? []) {
      mapa[fila.fecha] = fila.estado as EstadoDia;
    }
    setEstadoPorFecha(mapa);
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { estadoPorFecha, loading, recargar };
}
