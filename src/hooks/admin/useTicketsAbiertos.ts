'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Nº de tickets ABIERTOS para el badge del sidebar. Recuento simple al cargar (sin tiempo real); lo acota la RLS
 * (admin_empresa cuenta los de su empresa). `recargar` lo llama Soporte tras cambiar un estado.
 */
export function useTicketsAbiertos() {
  const [abiertos, setAbiertos] = useState(0);

  const recargar = useCallback(async () => {
    const { count } = await createClient().from('ticket').select('id', { count: 'exact', head: true }).eq('estado', 'abierto');
    setAbiertos(count ?? 0);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { abiertos, recargar };
}
