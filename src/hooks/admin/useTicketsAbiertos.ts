'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

async function contarAbiertos(): Promise<number> {
  const { count } = await createClient().from('ticket').select('id', { count: 'exact', head: true }).eq('estado', 'abierto');
  return count ?? 0;
}

/**
 * Nº de tickets ABIERTOS para el badge del sidebar. Recuento simple al cargar (sin tiempo real); lo acota la RLS
 * (admin_empresa cuenta los de su empresa). `recargar` lo llama Soporte tras cambiar un estado.
 */
export function useTicketsAbiertos() {
  const [abiertos, setAbiertos] = useState(0);

  useEffect(() => {
    let vigente = true;
    contarAbiertos().then((n) => {
      if (vigente) setAbiertos(n);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const recargar = useCallback(async () => {
    setAbiertos(await contarAbiertos());
  }, []);

  return { abiertos, recargar };
}
