'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resultadoMutacion } from '@/lib/supabase/mutaciones';
import { MES_NOMBRES, nombreDia } from '@/lib/horas/calendario';

export type TipoTicket = 'incidencia' | 'mejora' | 'consulta';
export type EstadoTicket = 'abierto' | 'en_curso' | 'resuelto';

export const ETIQUETA_TIPO_TICKET: Record<TipoTicket, string> = { incidencia: 'Incidencia', mejora: 'Mejora', consulta: 'Consulta' };
export const ETIQUETA_ESTADO_TICKET: Record<EstadoTicket, string> = { abierto: 'Abierto', en_curso: 'En curso', resuelto: 'Resuelto' };

export interface Ticket {
  id: string;
  ref: string;
  titulo: string;
  descripcion: string;
  tipo: TipoTicket;
  estado: EstadoTicket;
  creadoEn: string;
  autorId: string;
  autorNombre: string;
  empresaNombre: string;
}

export interface MensajeTicket {
  id: string;
  autorId: string;
  autorNombre: string;
  autorEsAdmin: boolean;
  texto: string;
  creadoEn: string;
}

/** "Jueves 11 sep" en hora de Madrid (como el mock). */
export function fechaTicket(iso: string): string {
  const [y, m, d] = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }).split('-').map(Number);
  return `${nombreDia(new Date(y, m - 1, d).getDay())} ${d} ${MES_NOMBRES[m - 1].slice(0, 3).toLowerCase()}`;
}

const SELECT = 'id, ref, titulo, descripcion, tipo, estado, creado_en, creado_por, creador:creado_por(nombre, empresa:empresa_id(nombre))';

async function leerTickets(soloMios: boolean): Promise<Ticket[]> {
  const supabase = createClient();
  let consulta = supabase.from('ticket').select(SELECT).order('creado_en', { ascending: false });
  if (soloMios) {
    // Hook de "lo mío" (norma de defensa en profundidad del PLAN): un admin ve TODOS por RLS, pero en el panel de Soporte
    // del avatar debe ver solo los suyos -- nunca delegar esa acotación solo en la RLS.
    const { data: sesion } = await supabase.auth.getUser();
    consulta = consulta.eq('creado_por', sesion.user?.id ?? '');
  }
  const { data } = await consulta;
  return (data ?? []).map((t) => ({
    id: t.id,
    ref: t.ref,
    titulo: t.titulo,
    descripcion: t.descripcion,
    tipo: t.tipo as TipoTicket,
    estado: t.estado as EstadoTicket,
    creadoEn: t.creado_en,
    autorId: t.creado_por,
    autorNombre: t.creador?.nombre ?? '',
    empresaNombre: t.creador?.empresa?.nombre ?? '',
  }));
}

/**
 * Tickets visibles para el usuario (la RLS de la 018 acota: empleado los suyos, admin_empresa los de su empresa,
 * admin_grupo todos; `soloMios` los restringe además a los propios, para el panel del avatar). Las mismas funciones sirven al lado empleado (crear) y al admin (cambiar estado, que la BD
 * solo permite a admins: el cliente no decide nada).
 */
export function useTickets({ soloMios = false }: { soloMios?: boolean } = {}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vigente = true;
    leerTickets(soloMios).then((lista) => {
      if (!vigente) return;
      setTickets(lista);
      setLoading(false);
    });
    return () => {
      vigente = false;
    };
  }, [soloMios]);

  const recargar = useCallback(async () => {
    setTickets(await leerTickets(soloMios));
  }, [soloMios]);

  const crear = useCallback(
    async (input: { tipo: TipoTicket; titulo: string; descripcion: string }) => {
      const supabase = createClient();
      const { data: sesion } = await supabase.auth.getUser();
      if (!sesion.user) return { error: 'Sesión no válida', ref: null as string | null };
      // La ref (T-001…) la genera la BD; el cliente solo dice quién y qué.
      const { data, error } = await supabase
        .from('ticket')
        .insert({ creado_por: sesion.user.id, titulo: input.titulo.trim(), descripcion: input.descripcion.trim(), tipo: input.tipo })
        .select('ref')
        .single();
      if (!error) await recargar();
      return { error: error?.message ?? null, ref: data?.ref ?? null };
    },
    [recargar]
  );

  const cambiarEstado = useCallback(
    async (id: string, estado: EstadoTicket) => {
      const { data, error } = await createClient().from('ticket').update({ estado }).eq('id', id).select('id');
      const r = resultadoMutacion(error, data);
      if (!r.error) await recargar();
      return r;
    },
    [recargar]
  );

  return { tickets, loading, recargar, crear, cambiarEstado };
}

async function leerHilo(ticketId: string): Promise<MensajeTicket[]> {
  const { data } = await createClient().rpc('ticket_hilo', { p_ticket: ticketId });
  return (data ?? []).map((m) => ({ id: m.id, autorId: m.autor_id, autorNombre: m.autor_nombre, autorEsAdmin: m.autor_es_admin, texto: m.texto, creadoEn: m.creado_en }));
}

/** Hilo de un ticket con el nombre del autor de cada mensaje (`ticket_hilo`, security definer: un empleado no lee perfiles ajenos). */
export function useTicketHilo(ticketId: string | null) {
  // El hilo cargado va etiquetado con SU ticket: `mensajes` y `loading` se derivan, sin setState síncrono en el efecto.
  const [hilo, setHilo] = useState<{ ticketId: string; mensajes: MensajeTicket[] } | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    let vigente = true;
    leerHilo(ticketId).then((mensajes) => {
      if (vigente) setHilo({ ticketId, mensajes });
    });
    return () => {
      vigente = false;
    };
  }, [ticketId]);

  const vigente = hilo !== null && hilo.ticketId === ticketId;
  const mensajes = vigente ? hilo.mensajes : [];
  const loading = ticketId !== null && !vigente;

  const recargar = useCallback(async () => {
    if (ticketId) setHilo({ ticketId, mensajes: await leerHilo(ticketId) });
  }, [ticketId]);

  const comentar = useCallback(
    async (texto: string) => {
      if (!ticketId) return { error: 'Sin ticket' };
      const supabase = createClient();
      const { data: sesion } = await supabase.auth.getUser();
      if (!sesion.user) return { error: 'Sesión no válida' };
      const { error } = await supabase.from('ticket_comentario').insert({ ticket_id: ticketId, autor_id: sesion.user.id, texto: texto.trim() });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [ticketId, recargar]
  );

  return { mensajes, loading, comentar, recargar };
}
