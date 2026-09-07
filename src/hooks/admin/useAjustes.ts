'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Ajustes {
  jornadaHoras: number;
  topeHorasDia: number;
  descripcionObligatoria: boolean;
  bloquearMesesCerrados: boolean;
  recordatorioEmail: boolean;
}

const CLAVE_DB: Record<keyof Ajustes, string> = {
  jornadaHoras: 'jornada_horas',
  topeHorasDia: 'tope_horas_dia',
  descripcionObligatoria: 'descripcion_obligatoria',
  bloquearMesesCerrados: 'bloquear_meses_cerrados',
  recordatorioEmail: 'recordatorio_email',
};

/** ajuste_select es abierto; escritura solo admin_grupo (ajuste_admin). */
export function useAjustes() {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('ajuste').select('clave, valor');
    const porClave = Object.fromEntries((data ?? []).map((f: any) => [f.clave, f.valor]));
    setAjustes({
      jornadaHoras: Number(porClave.jornada_horas ?? 7),
      topeHorasDia: Number(porClave.tope_horas_dia ?? 12),
      descripcionObligatoria: Boolean(porClave.descripcion_obligatoria ?? true),
      bloquearMesesCerrados: Boolean(porClave.bloquear_meses_cerrados ?? true),
      recordatorioEmail: Boolean(porClave.recordatorio_email ?? false),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const actualizar = useCallback(
    async (clave: keyof Ajustes, valor: number | boolean) => {
      const supabase = createClient();
      const { error } = await supabase.from('ajuste').update({ valor }).eq('clave', CLAVE_DB[clave]);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { ajustes, loading, recargar, actualizar };
}
