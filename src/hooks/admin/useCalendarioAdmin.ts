'use client';

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

/** ajuste_select/festivo_select son abiertos; escritura de jornada es solo admin_grupo, festivo acota admin_empresa a su empresa (null = grupo, solo admin_grupo). */
export function useCalendarioAdmin(anio: number, empresaId: string | null) {
  const [jornada, setJornada] = useState(7);
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [mesesRequeridos, setMesesRequeridos] = useState<MesRequerido[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: ajusteData }, { data: festivosData }] = await Promise.all([
      supabase.from('ajuste').select('valor').eq('clave', 'jornada_horas').single(),
      supabase.from('festivo').select('id, fecha, nombre, empresa_id, empresa:empresa_id(nombre)').order('fecha'),
    ]);

    const jornadaFresca = Number(ajusteData?.valor ?? 7);
    setJornada(jornadaFresca);
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
          const { data } = await supabase.rpc('horas_requeridas_mes', { p_anio: anio, p_mes: mes, p_empresa: empresaId });
          const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
          const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);
          const festivosDelMes = (festivosData ?? []).filter(
            (f: any) => f.fecha >= desde && f.fecha <= hasta && (f.empresa_id === null || f.empresa_id === empresaId)
          ).length;
          const horasRequeridas = Number(data ?? 0);
          return {
            mes,
            festivos: festivosDelMes,
            horasRequeridas,
            laborables: jornadaFresca > 0 ? Math.round(horasRequeridas / jornadaFresca) : 0,
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

  const actualizarJornada = useCallback(
    async (horas: number) => {
      const supabase = createClient();
      const { error } = await supabase.from('ajuste').update({ valor: horas }).eq('clave', 'jornada_horas');
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  const crearFestivo = useCallback(
    async (fecha: string, nombre: string, empresaIdAmbito: string | null) => {
      const supabase = createClient();
      const { error } = await supabase.from('festivo').insert({ fecha, nombre, empresa_id: empresaIdAmbito });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { jornada, festivos, mesesRequeridos, loading, recargar, actualizarJornada, crearFestivo };
}
