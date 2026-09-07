'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Faltante {
  perfilId: string;
  nombre: string;
  email: string;
  fecha: string;
  requerido: number;
  imputado: number;
  falta: number;
}

/** faltantes() (002) -- criterio empleado, ya bien acotada por rol; no se toca. */
export function useFaltantesAdmin(desde: string, hasta: string) {
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('faltantes', { p_desde: desde, p_hasta: hasta });
    setFaltantes(
      (data ?? []).map((f: any) => ({
        perfilId: f.perfil_id,
        nombre: f.nombre,
        email: f.email,
        fecha: f.fecha,
        requerido: Number(f.requerido),
        imputado: Number(f.imputado),
        falta: Number(f.falta),
      }))
    );
    setLoading(false);
  }, [desde, hasta]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { faltantes, loading, recargar };
}
