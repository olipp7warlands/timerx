'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getHorasAusenciaMes, requeridasEfectivas } from '@/lib/horas/requeridas-efectivas';

export interface BalanceMes {
  horasRequeridas: number;
  horasImputadas: number;
  diasVacaciones: number;
  diasBaja: number;
  diasPermiso: number;
  requeridasEfectivas: number;
  balance: number;
}

/**
 * balance_mes() (propia del empleado, existe aunque el mes esté vacío) + requeridasEfectivas().
 * `horasMes` = horas imputadas del mes que la pantalla ya tiene cargadas (mismo criterio: sin rechazadas): cuando cambia, el balance se
 * vuelve a pedir. Sin esto el «Mes» quedaba con el valor de antes de la última imputación mientras el héroe del día ya la contaba.
 */
export function useBalanceMes(anio: number, mes: number, horasMes?: number) {
  const [balance, setBalance] = useState<BalanceMes | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data }, { data: sesion }, ausencias] = await Promise.all([
      supabase.rpc('balance_mes', { p_anio: anio, p_mes: mes }),
      supabase.auth.getUser(),
      getHorasAusenciaMes(supabase, anio, mes),
    ]);

    const fila = data?.[0];
    if (!fila) {
      setBalance(null);
      setLoading(false);
      return;
    }

    const efectivas = requeridasEfectivas({
      horasRequeridas: fila.horas_requeridas,
      horasAusencia: ausencias.porPerfil.get(sesion.user?.id ?? '') ?? 0,
    });

    setBalance({
      horasRequeridas: fila.horas_requeridas,
      horasImputadas: fila.horas_imputadas,
      diasVacaciones: fila.dias_vacaciones,
      diasBaja: fila.dias_baja,
      diasPermiso: fila.dias_permiso,
      requeridasEfectivas: efectivas,
      balance: fila.horas_imputadas - efectivas,
    });
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar, horasMes]);

  return { balance, loading, recargar };
}
