'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface DepartamentoFila {
  id: string;
  nombre: string;
  activo: boolean;
  responsableId: string | null;
  responsableNombre: string | null;
  /** Especialidades ACTIVAS ligadas al departamento. */
  especialidades: number;
  /** Profesionales EN ACTIVO asignados al departamento. */
  profesionales: number;
}

export interface Persona {
  id: string;
  nombre: string;
}

/**
 * Regla de desactivación (la misma que Empresas/áreas: «reubica antes»): un departamento con especialidades activas o con
 * profesionales en activo no se desactiva. Devuelve el motivo o `null` si se puede.
 */
export function motivoNoDesactivable(d: Pick<DepartamentoFila, 'especialidades' | 'profesionales'>): string | null {
  const partes = [
    d.especialidades > 0 && `${d.especialidades} especialidad${d.especialidades === 1 ? '' : 'es'} activa${d.especialidades === 1 ? '' : 's'}`,
    d.profesionales > 0 && `${d.profesionales} profesional${d.profesionales === 1 ? '' : 'es'} en activo`,
  ].filter(Boolean);
  return partes.length ? `No se puede desactivar: tiene ${partes.join(' y ')}. Reubícalos antes.` : null;
}

/**
 * Sección Departamentos (solo admin_grupo: la RLS `departamento_admin` de la 024 ya lo exige; la UI además no la ofrece a
 * admin_empresa). Departamento es un catálogo GLOBAL sin `empresa_id`. Las escrituras mandan SOLO los campos presentes (lección 2) y
 * una RLS que deja 0 filas es un error, nunca un falso «guardado» (lección 8).
 */
export function useDepartamentosAdmin() {
  const [departamentos, setDepartamentos] = useState<DepartamentoFila[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  /** Lectura pura (sin setState): la comparten la carga inicial y `recargar`. */
  const cargar = useCallback(async () => {
    const supabase = createClient();
    const [deps, cats, pers] = await Promise.all([
      supabase.from('departamento').select('id, nombre, activo, responsable_id').order('nombre'),
      supabase.from('categoria').select('departamento_id, activa'),
      supabase.from('perfil').select('id, nombre, departamento_id, activo').order('nombre'),
    ]);
    const perfiles = pers.data ?? [];
    const nombrePorId = new Map(perfiles.map((p) => [p.id, p.nombre]));
    const filas: DepartamentoFila[] = (deps.data ?? []).map((d) => ({
      id: d.id,
      nombre: d.nombre,
      activo: d.activo,
      responsableId: d.responsable_id,
      responsableNombre: d.responsable_id ? nombrePorId.get(d.responsable_id) ?? null : null,
      especialidades: (cats.data ?? []).filter((c) => c.departamento_id === d.id && c.activa).length,
      profesionales: perfiles.filter((p) => p.departamento_id === d.id && p.activo).length,
    }));
    return { filas, personas: perfiles.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre })) };
  }, []);

  const recargar = useCallback(async () => {
    const r = await cargar();
    setDepartamentos(r.filas);
    setPersonas(r.personas);
  }, [cargar]);

  // Carga inicial: el setState llega DESPUÉS del await (no síncrono en el efecto). `loading` nace en true y no vuelve a true al recargar.
  useEffect(() => {
    let vivo = true;
    cargar().then((r) => {
      if (!vivo) return;
      setDepartamentos(r.filas);
      setPersonas(r.personas);
      setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [cargar]);

  const crear = useCallback(
    async (nombre: string, responsableId: string | null) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('departamento').insert({ nombre, responsable_id: responsableId }).select('id');
      if (!error && (data?.length ?? 0) === 0) return { error: 'No se pudo crear el departamento (sin permisos).' };
      if (!error) await recargar();
      return { error: error ? (error.code === '23505' ? `Ya existe un departamento llamado «${nombre}».` : error.message) : null };
    },
    [recargar]
  );

  const actualizar = useCallback(
    async (id: string, cambios: { nombre?: string; responsableId?: string | null; activo?: boolean }) => {
      const fila: { nombre?: string; responsable_id?: string | null; activo?: boolean } = {};
      if (cambios.nombre !== undefined) fila.nombre = cambios.nombre;
      if (cambios.responsableId !== undefined) fila.responsable_id = cambios.responsableId;
      if (cambios.activo !== undefined) fila.activo = cambios.activo;
      if (Object.keys(fila).length === 0) return { error: null };
      const supabase = createClient();
      const { data, error } = await supabase.from('departamento').update(fila).eq('id', id).select('id');
      if (!error && (data?.length ?? 0) === 0) return { error: 'No se pudo guardar: no tienes permisos sobre los departamentos.' };
      if (!error) await recargar();
      return { error: error ? (error.code === '23505' ? 'Ya existe otro departamento con ese nombre.' : error.message) : null };
    },
    [recargar]
  );

  return { departamentos, personas, loading, recargar, crear, actualizar };
}
