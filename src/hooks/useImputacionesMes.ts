'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ImputacionLinea {
  id: string;
  fecha: string;
  horas: number;
  estado: string;
  proyectoId: string;
  proyectoNombre: string;
  empresaNombre: string;
  categoriaNombre: string;
  subcategoriaId: string;
  subcategoriaNombre: string;
  motivoRechazo: string | null;
  descripcion: string | null;
}

export interface NuevaLinea {
  proyectoId: string;
  subcategoriaId: string;
  horas: number;
  fecha: string;
  descripcion?: string;
}

const SELECT = `
  id, fecha, horas, estado, proyecto_id, subcategoria_id, motivo_rechazo, descripcion,
  proyecto:proyecto_id(nombre, empresa:empresa_id(nombre)),
  subcategoria:subcategoria_id(nombre, categoria:categoria_id(nombre))
`;

function mapear(fila: any): ImputacionLinea {
  return {
    id: fila.id,
    fecha: fila.fecha,
    horas: Number(fila.horas),
    estado: fila.estado,
    proyectoId: fila.proyecto_id,
    proyectoNombre: fila.proyecto?.nombre ?? '',
    empresaNombre: fila.proyecto?.empresa?.nombre ?? '',
    categoriaNombre: fila.subcategoria?.categoria?.nombre ?? '',
    subcategoriaId: fila.subcategoria_id,
    subcategoriaNombre: fila.subcategoria?.nombre ?? '',
    motivoRechazo: fila.motivo_rechazo,
    descripcion: fila.descripcion,
  };
}

/** Extrae el mensaje del trigger (p.ej. "Supera el máximo de 12.00 horas...") tal cual, para el Toast. */
function mensajeError(error: { message: string } | null): string | null {
  if (!error) return null;
  return error.message;
}

export function useImputacionesMes(anio: number, mes: number) {
  const [porDia, setPorDia] = useState<Record<string, ImputacionLinea[]>>({});
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPorDia({});
      setLoading(false);
      return;
    }

    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('imputacion')
      .select(SELECT)
      .eq('empleado_id', user.id)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('created_at', { ascending: false });

    const agrupado: Record<string, ImputacionLinea[]> = {};
    for (const fila of data ?? []) {
      const linea = mapear(fila);
      (agrupado[linea.fecha] ??= []).push(linea);
    }
    setPorDia(agrupado);
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const insertar = useCallback(
    async (linea: NuevaLinea) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: 'No hay sesión activa' };

      const { error } = await supabase.from('imputacion').insert({
        empleado_id: user.id,
        proyecto_id: linea.proyectoId,
        subcategoria_id: linea.subcategoriaId,
        fecha: linea.fecha,
        horas: linea.horas,
        descripcion: linea.descripcion || null,
        estado: 'borrador',
      });
      if (!error) await recargar();
      return { error: mensajeError(error) };
    },
    [recargar]
  );

  /** Una sola llamada .insert([...]) — atómico: si una línea viola el trigger, no se inserta ninguna. */
  const insertarLote = useCallback(
    async (lineas: NuevaLinea[]) => {
      if (lineas.length === 0) return { error: null };
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: 'No hay sesión activa' };

      const filas = lineas.map((l) => ({
        empleado_id: user.id,
        proyecto_id: l.proyectoId,
        subcategoria_id: l.subcategoriaId,
        fecha: l.fecha,
        horas: l.horas,
        descripcion: l.descripcion || null,
        estado: 'borrador' as const,
      }));

      const { error } = await supabase.from('imputacion').insert(filas);
      if (!error) await recargar();
      return { error: mensajeError(error) };
    },
    [recargar]
  );

  const ajustarHoras = useCallback(
    async (id: string, horas: number) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('imputacion').update({ horas }).eq('id', id).select('id');
      if (!error) await recargar();
      // RLS bloquea sin error (0 filas) si la línea ya no está en borrador/rechazada: no es un éxito silencioso.
      if (!error && (data?.length ?? 0) === 0) {
        return { error: 'No se pudo modificar: la línea ya no está en borrador (puede que se haya enviado o aprobado).' };
      }
      return { error: mensajeError(error) };
    },
    [recargar]
  );

  const eliminar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('imputacion').delete().eq('id', id).select('id');
      if (!error) await recargar();
      if (!error && (data?.length ?? 0) === 0) {
        return { error: 'No se pudo eliminar: la línea ya no está en borrador (puede que se haya enviado o aprobado).' };
      }
      return { error: mensajeError(error) };
    },
    [recargar]
  );

  /** Envía a aprobación TODAS las líneas borrador/rechazada del mes cargado. */
  const enviarPendientes = useCallback(async () => {
    const ids = Object.values(porDia)
      .flat()
      .filter((l) => l.estado === 'borrador' || l.estado === 'rechazada')
      .map((l) => l.id);
    if (ids.length === 0) return { error: null, n: 0 };

    const supabase = createClient();
    const { data, error } = await supabase.rpc('enviar_imputaciones', { p_ids: ids });
    if (!error) await recargar();
    return { error: mensajeError(error), n: data ?? 0 };
  }, [porDia, recargar]);

  return { porDia, loading, insertar, insertarLote, ajustarHoras, eliminar, enviarPendientes, recargar };
}
