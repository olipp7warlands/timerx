'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PendienteMes {
  nombre: string;
  imputado: number;
  requerido: number;
  departamento: string | null;
}

export interface ResumenMes {
  anio: number;
  mes: number;
  totalEmpleados: number;
  alDia: number;
  conAusencia: number;
  sinImputar: number;
  horasRequeridasTotal: number;
  horasImputadasTotal: number;
  pendientes: PendienteMes[];
}

function mapear(json: any): ResumenMes {
  return {
    anio: json.anio,
    mes: json.mes,
    totalEmpleados: json.total_empleados,
    alDia: json.al_dia,
    conAusencia: json.con_ausencia,
    sinImputar: json.sin_imputar,
    horasRequeridasTotal: Number(json.horas_requeridas_total),
    horasImputadasTotal: Number(json.horas_imputadas_total),
    pendientes: (json.pendientes ?? []).map((p: any) => ({
      nombre: p.nombre,
      imputado: Number(p.imputado),
      requerido: Number(p.requerido),
      departamento: p.departamento,
    })),
  };
}

/** KPIs de Inicio > Resumen del mes. requerido ya neto de ausencias aprobadas (resumen_mes() en 010). */
export function useResumenMes(anio: number, mes: number) {
  const [resumen, setResumen] = useState<ResumenMes | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('resumen_mes', { p_anio: anio, p_mes: mes });
    setResumen(data ? mapear(data) : null);
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { resumen, loading, recargar };
}
