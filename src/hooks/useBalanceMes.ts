'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getJornadaHoras, requeridasEfectivas } from '@/lib/horas/requeridas-efectivas';

export interface BalanceMes {
  horasRequeridas: number;
  horasImputadas: number;
  diasVacaciones: number;
  diasBaja: number;
  diasPermiso: number;
  jornadaHoras: number;
  requeridasEfectivas: number;
  balance: number;
}

/** balance_mes() (propia del empleado, existe aunque el mes esté vacío) + requeridasEfectivas(). */
export function useBalanceMes(anio: number, mes: number) {
  const [balance, setBalance] = useState<BalanceMes | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data }, jornadaHoras] = await Promise.all([
      supabase.rpc('balance_mes', { p_anio: anio, p_mes: mes }),
      getJornadaHoras(supabase),
    ]);

    const fila = data?.[0];
    if (!fila) {
      setBalance(null);
      setLoading(false);
      return;
    }

    const efectivas = requeridasEfectivas({
      horasRequeridas: fila.horas_requeridas,
      diasVacaciones: fila.dias_vacaciones,
      diasBaja: fila.dias_baja,
      diasPermiso: fila.dias_permiso,
      jornadaHoras,
    });

    setBalance({
      horasRequeridas: fila.horas_requeridas,
      horasImputadas: fila.horas_imputadas,
      diasVacaciones: fila.dias_vacaciones,
      diasBaja: fila.dias_baja,
      diasPermiso: fila.dias_permiso,
      jornadaHoras,
      requeridasEfectivas: efectivas,
      balance: fila.horas_imputadas - efectivas,
    });
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { balance, loading, recargar };
}
