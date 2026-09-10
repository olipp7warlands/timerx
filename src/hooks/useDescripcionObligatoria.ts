'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** ajuste.descripcion_obligatoria (ajuste_select abierta a todos) -- gobierna si el campo es requerido en UI, reflejo de descripcion_obligatoria() (012). */
export function useDescripcionObligatoria() {
  const [obligatoria, setObligatoria] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('ajuste').select('valor').eq('clave', 'descripcion_obligatoria').single();
      if (!cancelado) setObligatoria(Boolean(data?.valor ?? false));
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return obligatoria;
}
