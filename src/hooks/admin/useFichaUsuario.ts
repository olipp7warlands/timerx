'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ProyectoHorasUsuario {
  proyectoId: string;
  proyectoNombre: string;
  horas: number;
}

export interface LineaUsuario {
  id: string;
  fecha: string;
  proyectoNombre: string;
  horas: number;
  estado: string;
}

const SELECT = `
  id, fecha, horas, estado, proyecto_id,
  proyecto:proyecto_id(nombre)
`;

/**
 * Ficha de usuario (admin): reparto del mes por proyecto y últimas
 * imputaciones de un empleado concreto. Criterio operativo (estado <>
 * 'rechazada', pedido explícitamente -- más amplio que el de valoración
 * aprobada/cerrada de la ficha de proyecto). imputacion_select ya permite a
 * un admin leer imputaciones de cualquier empleado en su ámbito (lo prueba
 * useFichaProyecto, que agrega por persona desde hace tiempo).
 */
export function useFichaUsuario(empleadoId: string | null, anio: number, mes: number) {
  const [porProyecto, setPorProyecto] = useState<ProyectoHorasUsuario[]>([]);
  const [ultimas, setUltimas] = useState<LineaUsuario[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    if (!empleadoId) {
      setPorProyecto([]);
      setUltimas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);

    const { data } = await supabase
      .from('imputacion')
      .select(SELECT)
      .eq('empleado_id', empleadoId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .neq('estado', 'rechazada')
      .order('fecha', { ascending: false });

    const filas = (data ?? []) as any[];

    const porProyectoMap = new Map<string, ProyectoHorasUsuario>();
    for (const f of filas) {
      const actual = porProyectoMap.get(f.proyecto_id) ?? { proyectoId: f.proyecto_id, proyectoNombre: f.proyecto?.nombre ?? '', horas: 0 };
      actual.horas += Number(f.horas);
      porProyectoMap.set(f.proyecto_id, actual);
    }

    setPorProyecto([...porProyectoMap.values()].sort((a, b) => b.horas - a.horas));
    setUltimas(
      filas.slice(0, 10).map((f) => ({
        id: f.id,
        fecha: f.fecha,
        proyectoNombre: f.proyecto?.nombre ?? '',
        horas: Number(f.horas),
        estado: f.estado,
      }))
    );
    setLoading(false);
  }, [empleadoId, anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { porProyecto, ultimas, loading, recargar };
}
