'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CosteVigente {
  costeHora: number;
  desde: string;
}

/**
 * Coste/hora vigente (mayor `desde` <= hoy) de UN empleado, vía `v_coste_vigente` (security_invoker).
 * Dato salarial: la RLS de `coste_empleado` solo deja pasar a admin_grupo, y el llamador SOLO debe activar
 * el hook para admin_grupo (`habilitado`); para cualquier otro rol no se lanza ni la consulta.
 */
export function useCosteVigente(perfilId: string, habilitado: boolean) {
  const [coste, setCoste] = useState<CosteVigente | null>(null);
  const [loading, setLoading] = useState(habilitado);

  useEffect(() => {
    if (!habilitado) return;
    let vigente = true;
    createClient()
      .from('v_coste_vigente')
      .select('coste_hora, desde')
      .eq('perfil_id', perfilId)
      .maybeSingle()
      .then(({ data }) => {
        if (!vigente) return;
        setCoste(data?.desde ? { costeHora: Number(data.coste_hora), desde: data.desde } : null);
        setLoading(false);
      });
    return () => {
      vigente = false;
    };
  }, [perfilId, habilitado]);

  return { coste, loading };
}
