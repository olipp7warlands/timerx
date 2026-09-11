'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getJornadaHoras, requeridasEfectivas } from '@/lib/horas/requeridas-efectivas';

export interface BalanceMesEmpleado {
  horasRequeridas: number;
  horasImputadas: number;
  diasVacaciones: number;
  diasBaja: number;
  diasPermiso: number;
  jornadaHoras: number;
  requeridasEfectivas: number;
  balance: number;
}

/**
 * balance_mes_empleado() para la ficha de usuario (admin). Devuelve `null`
 * tanto si el empleado no existe como si admin_puede_ver_empresa() lo
 * bloquea (empleado intragrupo para un admin_empresa) -- el RPC se
 * autoacota sin `raise`, cero filas en ambos casos; el componente lo trata
 * como "fuera de tu empresa", no como error.
 */
export function useBalanceMesEmpleado(empleadoId: string | null, anio: number, mes: number) {
  const [balance, setBalance] = useState<BalanceMesEmpleado | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    if (!empleadoId) {
      setBalance(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const [{ data }, jornadaHoras] = await Promise.all([
      supabase.rpc('balance_mes_empleado', { p_empleado_id: empleadoId, p_anio: anio, p_mes: mes }),
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
  }, [empleadoId, anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { balance, loading, recargar };
}
