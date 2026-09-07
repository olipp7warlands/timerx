'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PendienteDia {
  nombre: string;
  imputado: number;
  requerido: number;
  departamento: string | null;
}

export interface AusenteDia {
  nombre: string;
  tipo: string;
  departamento: string | null;
}

export interface ResumenDia {
  fecha: string;
  jornada: number;
  totalEmpleados: number;
  alDia: number;
  conAusencia: number;
  sinImputar: number;
  pendientes: PendienteDia[];
  ausentes: AusenteDia[];
}

function mapear(json: any): ResumenDia {
  return {
    fecha: json.fecha,
    jornada: Number(json.jornada),
    totalEmpleados: json.total_empleados,
    alDia: json.al_dia,
    conAusencia: json.con_ausencia,
    sinImputar: json.sin_imputar,
    pendientes: (json.pendientes ?? []).map((p: any) => ({
      nombre: p.nombre,
      imputado: Number(p.imputado),
      requerido: Number(p.requerido),
      departamento: p.departamento,
    })),
    ausentes: (json.ausentes ?? []).map((a: any) => ({ nombre: a.nombre, tipo: a.tipo, departamento: a.departamento })),
  };
}

/** KPIs de Inicio > Seguimiento del día. Criterio empleado (resumen_dia() en 010), acotado por empresa en servidor. */
export function useResumenDia(fecha: string) {
  const [resumen, setResumen] = useState<ResumenDia | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('resumen_dia', { p_fecha: fecha });
    setResumen(data ? mapear(data) : null);
    setLoading(false);
  }, [fecha]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { resumen, loading, recargar };
}
