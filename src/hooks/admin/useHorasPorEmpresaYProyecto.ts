'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface HorasEmpresa {
  empresaId: string;
  empresaNombre: string;
  horas: number;
}

export interface HorasProyecto {
  proyectoId: string;
  proyectoNombre: string;
  empresaId: string;
  empresaNombre: string;
  horas: number;
}

const SELECT = `
  horas, proyecto_id,
  proyecto:proyecto_id(nombre, empresa_id, empresa:empresa_id(nombre))
`;

/**
 * Horas por empresa y por proyecto del mes — criterio VALORACIÓN (aprobada+cerrada),
 * no el operativo de faltantes/resumen_dia. El ámbito lo resuelve la RLS de imputacion,
 * ya corregida en 006/007/008 para el caso intragrupo.
 */
export function useHorasPorEmpresaYProyecto(anio: number, mes: number) {
  const [porEmpresa, setPorEmpresa] = useState<HorasEmpresa[]>([]);
  const [porProyecto, setPorProyecto] = useState<HorasProyecto[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);

    const { data } = await supabase
      .from('imputacion')
      .select(SELECT)
      .in('estado', ['aprobada', 'cerrada'])
      .gte('fecha', desde)
      .lte('fecha', hasta);

    const empresas = new Map<string, HorasEmpresa>();
    const proyectos = new Map<string, HorasProyecto>();

    for (const fila of (data ?? []) as any[]) {
      const proyecto = fila.proyecto;
      if (!proyecto) continue;
      const horas = Number(fila.horas);

      const empresaActual = empresas.get(proyecto.empresa_id) ?? {
        empresaId: proyecto.empresa_id,
        empresaNombre: proyecto.empresa?.nombre ?? '',
        horas: 0,
      };
      empresaActual.horas += horas;
      empresas.set(proyecto.empresa_id, empresaActual);

      const proyectoActual = proyectos.get(fila.proyecto_id) ?? {
        proyectoId: fila.proyecto_id,
        proyectoNombre: proyecto.nombre,
        empresaId: proyecto.empresa_id,
        empresaNombre: proyecto.empresa?.nombre ?? '',
        horas: 0,
      };
      proyectoActual.horas += horas;
      proyectos.set(fila.proyecto_id, proyectoActual);
    }

    setPorEmpresa([...empresas.values()].sort((a, b) => b.horas - a.horas));
    setPorProyecto([...proyectos.values()].sort((a, b) => b.horas - a.horas));
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { porEmpresa, porProyecto, loading, recargar };
}
