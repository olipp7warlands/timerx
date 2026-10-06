'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { invalidarColoresDepartamento } from '@/hooks/useColoresDepartamento';
import { siguienteColorLibre } from '@/lib/horas/colores-departamento';
import { fijarVinculoEmpresa } from '@/lib/departamentos/vinculo-empresa';

export interface Especialidad {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface DepartamentoFila {
  id: string;
  nombre: string;
  activo: boolean;
  color: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  /** Categoría ESPEJO del departamento (la clave del dinero: tarifas, refacturación y cierre cuelgan de ella). */
  espejoId: string | null;
  /** Todas sus especialidades (activas e inactivas). */
  especialidades: Especialidad[];
  /** Empresas donde existe el departamento (`empresa_departamento`). */
  empresaIds: string[];
  /** Profesionales EN ACTIVO asignados al departamento. */
  profesionales: number;
  /** Los mismos, por empresa (id de empresa → nº). */
  profesionalesPorEmpresa: Record<string, number>;
}

export interface Persona {
  id: string;
  nombre: string;
}
export interface EmpresaOpcion {
  id: string;
  nombre: string;
}

export const especialidadesActivas = (d: Pick<DepartamentoFila, 'especialidades'>) => d.especialidades.filter((e) => e.activa).length;

/**
 * Regla de desactivación (la misma que Empresas/áreas: «reubica antes»): un departamento con especialidades activas o con
 * profesionales en activo no se desactiva. Devuelve el motivo o `null` si se puede.
 */
export function motivoNoDesactivable(d: Pick<DepartamentoFila, 'especialidades' | 'profesionales'>): string | null {
  const esp = d.especialidades.filter((e) => e.activa).length;
  const partes = [
    esp > 0 && `${esp} especialidad${esp === 1 ? '' : 'es'} activa${esp === 1 ? '' : 's'}`,
    d.profesionales > 0 && `${d.profesionales} profesional${d.profesionales === 1 ? '' : 'es'} en activo`,
  ].filter(Boolean);
  return partes.length ? `No se puede desactivar: tiene ${partes.join(' y ')}. Reubícalos antes.` : null;
}

const mensajeDe = (error: { code?: string; message: string }, duplicado: string) => (error.code === '23505' ? duplicado : error.message);

interface FilaCategoria {
  id: string;
  departamento_id: string;
  subcategoria: { id: string; nombre: string; activa: boolean }[] | null;
}

/**
 * Sección Departamentos (v2.0, FUSIONA la antigua Especialidades; solo admin_grupo: la RLS `departamento_admin` de la 024 lo exige).
 * Departamento → sus especialidades (= `subcategoria` bajo su categoría ESPEJO, que mantiene el trigger de la 030 en la misma
 * transacción). Las escrituras mandan SOLO los campos presentes (lección 2) y una RLS que deja 0 filas es un error, nunca un falso
 * «guardado» (lección 8).
 */
export function useDepartamentosAdmin() {
  const [departamentos, setDepartamentos] = useState<DepartamentoFila[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpcion[]>([]);
  const [loading, setLoading] = useState(true);

  /** Lectura pura (sin setState): la comparten la carga inicial y `recargar`. */
  const cargar = useCallback(async () => {
    const supabase = createClient();
    const [deps, cats, pers, emp, vinc] = await Promise.all([
      supabase.from('departamento').select('id, nombre, activo, color, responsable_id').order('nombre'),
      supabase.from('categoria').select('id, departamento_id, subcategoria(id, nombre, activa)'),
      supabase.from('perfil').select('id, nombre, departamento_id, empresa_id, activo').order('nombre'),
      supabase.from('empresa').select('id, nombre').order('nombre'),
      supabase.from('empresa_departamento').select('empresa_id, departamento_id'),
    ]);
    const perfiles = pers.data ?? [];
    const nombrePorId = new Map(perfiles.map((p) => [p.id, p.nombre]));
    const categorias = (cats.data ?? []) as unknown as FilaCategoria[];
    const filas: DepartamentoFila[] = (deps.data ?? []).map((d) => {
      const espejo = categorias.find((c) => c.departamento_id === d.id) ?? null;
      return {
        id: d.id,
        nombre: d.nombre,
        activo: d.activo,
        color: d.color,
        responsableId: d.responsable_id,
        responsableNombre: d.responsable_id ? nombrePorId.get(d.responsable_id) ?? null : null,
        espejoId: espejo?.id ?? null,
        especialidades: [...(espejo?.subcategoria ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        empresaIds: (vinc.data ?? []).filter((v) => v.departamento_id === d.id).map((v) => v.empresa_id),
        profesionales: perfiles.filter((p) => p.departamento_id === d.id && p.activo).length,
        profesionalesPorEmpresa: perfiles
          .filter((p) => p.departamento_id === d.id && p.activo)
          .reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.empresa_id]: (acc[p.empresa_id] ?? 0) + 1 }), {}),
      };
    });
    return {
      filas,
      personas: perfiles.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre })),
      empresas: (emp.data ?? []).map((e) => ({ id: e.id, nombre: e.nombre })),
    };
  }, []);

  const recargar = useCallback(async () => {
    const r = await cargar();
    setDepartamentos(r.filas);
    setPersonas(r.personas);
    setEmpresas(r.empresas);
    invalidarColoresDepartamento();
  }, [cargar]);

  // Carga inicial: el setState llega DESPUÉS del await (no síncrono en el efecto). `loading` nace en true y no vuelve a true al recargar.
  useEffect(() => {
    let vivo = true;
    cargar().then((r) => {
      if (!vivo) return;
      setDepartamentos(r.filas);
      setPersonas(r.personas);
      setEmpresas(r.empresas);
      setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [cargar]);

  /** Altas (una o varias): cada departamento nace con su espejo (trigger), su color y sus empresas. Los nombres que ya existen se saltan. */
  const crear = useCallback(
    async (nuevos: { nombre: string; color?: string | null; responsableId?: string | null }[], empresaIds: string[]) => {
      const supabase = createClient();
      const existentes = new Set(departamentos.map((d) => d.nombre.toLowerCase()));
      const usados = departamentos.map((d) => d.color);
      const creados: string[] = [];
      const ids: string[] = [];
      const saltados: string[] = [];
      for (const n of nuevos) {
        const nombre = n.nombre.trim();
        if (!nombre) continue;
        if (existentes.has(nombre.toLowerCase())) {
          saltados.push(nombre);
          continue;
        }
        const color = n.color ?? siguienteColorLibre(usados);
        const { data, error } = await supabase.from('departamento').insert({ nombre, color, responsable_id: n.responsableId ?? null }).select('id');
        if (error || (data?.length ?? 0) === 0) {
          await recargar();
          return { error: error ? mensajeDe(error, `Ya existe un departamento llamado «${nombre}».`) : 'No se pudo crear el departamento (sin permisos).', creados, ids, saltados };
        }
        usados.push(color);
        existentes.add(nombre.toLowerCase());
        creados.push(nombre);
        ids.push(data[0].id);
        if (empresaIds.length > 0) {
          const { error: eVinc } = await supabase.from('empresa_departamento').insert(empresaIds.map((e) => ({ empresa_id: e, departamento_id: data![0].id })));
          if (eVinc) {
            await recargar();
            return { error: `«${nombre}» se creó, pero no se pudo asignar a las empresas: ${eVinc.message}`, creados, ids, saltados };
          }
        }
      }
      await recargar();
      return { error: null, creados, ids, saltados };
    },
    [departamentos, recargar]
  );

  const actualizar = useCallback(
    async (id: string, cambios: { nombre?: string; responsableId?: string | null; activo?: boolean; color?: string | null }) => {
      const fila: { nombre?: string; responsable_id?: string | null; activo?: boolean; color?: string | null } = {};
      if (cambios.nombre !== undefined) fila.nombre = cambios.nombre;
      if (cambios.responsableId !== undefined) fila.responsable_id = cambios.responsableId;
      if (cambios.activo !== undefined) fila.activo = cambios.activo;
      if (cambios.color !== undefined) fila.color = cambios.color;
      if (Object.keys(fila).length === 0) return { error: null };
      const supabase = createClient();
      const { data, error } = await supabase.from('departamento').update(fila).eq('id', id).select('id');
      if (!error && (data?.length ?? 0) === 0) return { error: 'No se pudo guardar: no tienes permisos sobre los departamentos.' };
      if (!error) await recargar();
      return { error: error ? mensajeDe(error, 'Ya existe otro departamento con ese nombre.') : null };
    },
    [recargar]
  );

  /** Pone o quita UNA empresa del departamento (la misma mutación que usa la ficha de la empresa, con su guarda de profesionales). */
  const fijarEmpresa = useCallback(
    async (id: string, empresaId: string, existe: boolean) => {
      const r = await fijarVinculoEmpresa(empresaId, id, existe);
      await recargar();
      return r;
    },
    [recargar]
  );

  const crearEspecialidad = useCallback(
    async (departamentoId: string, nombre: string) => {
      const espejo = departamentos.find((d) => d.id === departamentoId)?.espejoId;
      if (!espejo) return { error: 'Este departamento no tiene su categoría espejo: avisa a soporte.' };
      const supabase = createClient();
      const { data, error } = await supabase.from('subcategoria').insert({ categoria_id: espejo, nombre: nombre.trim() }).select('id');
      if (!error && (data?.length ?? 0) === 0) return { error: 'No se pudo crear la especialidad (sin permisos).' };
      if (!error) await recargar();
      return { error: error ? mensajeDe(error, `Ya existe una especialidad llamada «${nombre.trim()}» en este departamento.`) : null };
    },
    [departamentos, recargar]
  );

  const actualizarEspecialidad = useCallback(
    async (id: string, cambios: { nombre?: string; activa?: boolean }) => {
      const fila: { nombre?: string; activa?: boolean } = {};
      if (cambios.nombre !== undefined) fila.nombre = cambios.nombre.trim();
      if (cambios.activa !== undefined) fila.activa = cambios.activa;
      if (Object.keys(fila).length === 0) return { error: null };
      const supabase = createClient();
      const { data, error } = await supabase.from('subcategoria').update(fila).eq('id', id).select('id');
      if (!error && (data?.length ?? 0) === 0) return { error: 'No se pudo guardar la especialidad (sin permisos).' };
      if (!error) await recargar();
      return { error: error ? mensajeDe(error, 'Ya existe otra especialidad con ese nombre en este departamento.') : null };
    },
    [recargar]
  );

  return { departamentos, personas, empresas, loading, recargar, crear, actualizar, fijarEmpresa, crearEspecialidad, actualizarEspecialidad };
}
