'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CategoriaHoras {
  categoriaId: string;
  nombre: string;
  horas: number;
}

export interface DepartamentoHoras {
  departamento: string;
  horas: number;
}

export interface PersonaHoras {
  perfilId: string;
  nombre: string;
  departamento: string | null;
  categoriaNombre: string;
  horas: number;
}

export interface FichaProyecto {
  horasMes: number;
  horasAcumuladoAnio: number;
  refacturableMes: number;
  porCategoria: CategoriaHoras[];
  porDepartamento: DepartamentoHoras[];
  porPersona: PersonaHoras[];
}

const SELECT = `
  horas, empleado_id,
  empleado:empleado_id(nombre, departamento:departamento_id(nombre)),
  subcategoria:subcategoria_id(categoria:categoria_id(id, nombre))
`;

/**
 * Ficha de proyecto (equivalente real del PDET/verProyecto() del mock): agregación
 * por categoría, departamento y persona, criterio VALORACIÓN (aprobada+cerrada).
 * Una persona puede aparecer más de una vez si trabajó el proyecto bajo más de una
 * categoría ese mes -- más granular que el mock, que solo mostraba una por fila.
 */
export function useFichaProyecto(proyectoId: string | null, anio: number, mes: number) {
  const [ficha, setFicha] = useState<FichaProyecto | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    if (!proyectoId) {
      setFicha(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);
    const desdeAnio = `${anio}-01-01`;

    const [{ data: filasMes }, { data: filasAnio }, { data: filasRefact }] = await Promise.all([
      supabase.from('imputacion').select(SELECT).eq('proyecto_id', proyectoId).in('estado', ['aprobada', 'cerrada']).gte('fecha', desde).lte('fecha', hasta),
      supabase.from('imputacion').select('horas').eq('proyecto_id', proyectoId).in('estado', ['aprobada', 'cerrada']).gte('fecha', desdeAnio).lte('fecha', hasta),
      supabase.from('v_refacturacion_mensual').select('importe').eq('proyecto_id', proyectoId).eq('anio', anio).eq('mes', mes),
    ]);

    const categorias = new Map<string, CategoriaHoras>();
    const departamentos = new Map<string, DepartamentoHoras>();
    const personas = new Map<string, PersonaHoras>();
    let horasMes = 0;

    for (const fila of (filasMes ?? []) as any[]) {
      const horas = Number(fila.horas);
      horasMes += horas;

      const cat = fila.subcategoria?.categoria;
      if (cat) {
        const actual = categorias.get(cat.id) ?? { categoriaId: cat.id, nombre: cat.nombre, horas: 0 };
        actual.horas += horas;
        categorias.set(cat.id, actual);
      }

      const depNombre = fila.empleado?.departamento?.nombre ?? 'Sin departamento';
      const dep = departamentos.get(depNombre) ?? { departamento: depNombre, horas: 0 };
      dep.horas += horas;
      departamentos.set(depNombre, dep);

      const clavePersona = `${fila.empleado_id}:${cat?.id ?? 'sin-categoria'}`;
      const persona = personas.get(clavePersona) ?? {
        perfilId: fila.empleado_id,
        nombre: fila.empleado?.nombre ?? '',
        departamento: fila.empleado?.departamento?.nombre ?? null,
        categoriaNombre: cat?.nombre ?? 'Sin categoría',
        horas: 0,
      };
      persona.horas += horas;
      personas.set(clavePersona, persona);
    }

    const horasAcumuladoAnio = (filasAnio ?? []).reduce((acc: number, f: any) => acc + Number(f.horas), 0);
    const refacturableMes = (filasRefact ?? []).reduce((acc: number, f: any) => acc + Number(f.importe), 0);

    setFicha({
      horasMes,
      horasAcumuladoAnio,
      refacturableMes,
      porCategoria: [...categorias.values()].sort((a, b) => b.horas - a.horas),
      porDepartamento: [...departamentos.values()].sort((a, b) => b.horas - a.horas),
      porPersona: [...personas.values()].sort((a, b) => b.horas - a.horas),
    });
    setLoading(false);
  }, [proyectoId, anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { ficha, loading, recargar };
}
