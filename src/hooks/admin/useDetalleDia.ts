'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PersonaDia {
  id: string;
  nombre: string;
  empresaId: string;
  empresaNombre: string;
  horas: number;
  proyectos: string[];
}

/**
 * Desglose por persona de UN día (horas y proyectos) para el "Resumen del día" del calendario admin.
 * `resumen_dia()` decide quién está al día / falta / ausente; esto solo añade el detalle que su JSON no trae, leyendo
 * `perfil` e `imputacion` con la RLS del propio admin (criterio de horas de empleado: estado <> 'rechazada').
 * Límite conocido: un admin_empresa solo ve las imputaciones cuyo proyecto es de su empresa, así que el desglose de
 * alguien de su gente que imputó en proyectos de otra empresa puede quedarse corto; el ESTADO (resumen_dia) no.
 */
export function useDetalleDia(fecha: string | null) {
  const [personas, setPersonas] = useState<PersonaDia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    async function cargar() {
      setLoading(true);
      const supabase = createClient();
      const [perfiles, imputaciones] = await Promise.all([
        supabase.from('perfil').select('id, nombre, empresa_id, empresa:empresa_id(nombre)').eq('activo', true).order('nombre'),
        supabase.from('imputacion').select('empleado_id, horas, proyecto:proyecto_id(nombre)').eq('fecha', fecha!).neq('estado', 'rechazada'),
      ]);
      if (!vigente) return;
      const porEmpleado = new Map<string, { horas: number; proyectos: Set<string> }>();
      for (const i of imputaciones.data ?? []) {
        const acc = porEmpleado.get(i.empleado_id) ?? { horas: 0, proyectos: new Set<string>() };
        acc.horas += Number(i.horas);
        if (i.proyecto?.nombre) acc.proyectos.add(i.proyecto.nombre);
        porEmpleado.set(i.empleado_id, acc);
      }
      setPersonas(
        (perfiles.data ?? []).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          empresaId: p.empresa_id,
          empresaNombre: p.empresa?.nombre ?? '',
          horas: porEmpleado.get(p.id)?.horas ?? 0,
          proyectos: [...(porEmpleado.get(p.id)?.proyectos ?? [])],
        }))
      );
      setLoading(false);
    }
    cargar();
    return () => {
      vigente = false;
    };
  }, [fecha]);

  return { personas, loading };
}
