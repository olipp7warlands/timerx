'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** perfil.max_horas_dia del usuario logueado, con fallback a ajuste.tope_horas_dia (nunca hardcodeado). */
export function useMaxHorasDia() {
  const [maxHorasDia, setMaxHorasDia] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: perfil } = await supabase.from('perfil').select('max_horas_dia').eq('id', user.id).single();
      let valor = perfil?.max_horas_dia ?? null;

      if (valor == null) {
        const { data: ajuste } = await supabase.from('ajuste').select('valor').eq('clave', 'tope_horas_dia').single();
        valor = Number(ajuste?.valor ?? 12);
      }

      if (cancelado) return;
      setMaxHorasDia(Number(valor));
      setLoading(false);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { maxHorasDia, loading };
}
