'use client';

import { ultimoDiaMes } from '@/lib/fechas';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Festivo {
  id: string;
  fecha: string;
  nombre: string;
  empresaId: string | null;
  empresaNombre: string | null;
}

export interface MesRequerido {
  mes: number;
  laborables: number;
  festivos: number;
  horasRequeridas: number;
}

/** festivo_select es abierto; escritura de festivo acota admin_empresa a su empresa (null = grupo, solo admin_grupo). La jornada semanal vive en useJornadaSemanal. */
export function useCalendarioAdmin(anio: number, empresaId: string | null) {
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [mesesRequeridos, setMesesRequeridos] = useState<MesRequerido[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: festivosData } = await supabase.from('festivo').select('id, fecha, nombre, empresa_id, empresa:empresa_id(nombre)').order('fecha');

    setFestivos(
      (festivosData ?? []).map((f: any) => ({
        id: f.id,
        fecha: f.fecha,
        nombre: f.nombre,
        empresaId: f.empresa_id,
        empresaNombre: f.empresa?.nombre ?? null,
      }))
    );

    if (empresaId) {
      const meses = await Promise.all(
        Array.from({ length: 12 }, (_, i) => i + 1).map(async (mes) => {
          // Laborables y horas salen de la misma BD (jornada_dias_mes / horas_requeridas_mes, 019): con jornada semanal
          // variable ya no vale "horas / jornada plana".
          const [{ data }, { data: diasMes }] = await Promise.all([
            supabase.rpc('horas_requeridas_mes', { p_anio: anio, p_mes: mes, p_empresa: empresaId }),
            supabase.rpc('jornada_dias_mes', { p_anio: anio, p_mes: mes, p_empresa: empresaId }),
          ]);
          const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
          const hasta = ultimoDiaMes(anio, mes);
          const festivosDelMes = (festivosData ?? []).filter(
            (f: any) => f.fecha >= desde && f.fecha <= hasta && (f.empresa_id === null || f.empresa_id === empresaId)
          ).length;
          const horasRequeridas = Number(data ?? 0);
          return {
            mes,
            festivos: festivosDelMes,
            horasRequeridas,
            laborables: (diasMes ?? []).filter((d) => d.laborable).length,
          };
        })
      );
      setMesesRequeridos(meses);
    } else {
      setMesesRequeridos([]);
    }

    setLoading(false);
  }, [anio, empresaId]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crearFestivo = useCallback(
    async (fecha: string, nombre: string, empresaIdAmbito: string | null) => {
      const supabase = createClient();
      const { error } = await supabase.from('festivo').insert({ fecha, nombre, empresa_id: empresaIdAmbito });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { festivos, mesesRequeridos, loading, recargar, crearFestivo };
}
