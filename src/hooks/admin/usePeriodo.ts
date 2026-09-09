'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Estado real de la tabla periodo (periodo_select abierta) para el KPI "Estado del periodo". */
export function usePeriodo(empresaId: string, anio: number, mes: number) {
  const [cerrado, setCerrado] = useState(false);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('periodo')
      .select('estado')
      .eq('empresa_id', empresaId)
      .eq('anio', anio)
      .eq('mes', mes)
      .maybeSingle();
    setCerrado(data?.estado === 'cerrado');
    setLoading(false);
  }, [empresaId, anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { cerrado, loading, recargar };
}
