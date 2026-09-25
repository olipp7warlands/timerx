'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NovedadSoporte {
  /** Ids de MIS tickets con algo nuevo de otra persona (comentario o cambio de estado) desde la última vez que los abrí. */
  ids: ReadonlySet<string>;
  hay: boolean;
  recargar: () => Promise<void>;
  /** Marca el ticket como visto (hora del servidor, migración 027) y apaga su punto sin esperar a otra lectura. */
  marcarVisto: (ticketId: string) => Promise<void>;
}

const SIN_NOVEDAD: NovedadSoporte = { ids: new Set(), hay: false, recargar: async () => {}, marcarVisto: async () => {} };
const Ctx = createContext<NovedadSoporte>(SIN_NOVEDAD);

async function leerNovedades(): Promise<Set<string>> {
  const { data } = await createClient().rpc('tickets_con_novedad');
  return new Set((data ?? []).map((r) => r.ticket_id));
}

/**
 * Novedades de Soporte de la persona con sesión (punto en el menú del avatar, en la entrada/pestaña de Soporte y en la lista).
 * Un solo recuento al cargar la app, sin tiempo real (mismo criterio que el badge de tickets abiertos del admin). Vive como
 * contexto de React —no como store de módulo— para no arrastrar el estado de un usuario a otro en la misma pestaña.
 * Sin proveedor (p. ej. una página de depuración) los consumidores ven «sin novedad» y las acciones no hacen nada.
 */
export function SoporteNovedadProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let vigente = true;
    leerNovedades().then((s) => {
      if (vigente) setIds(s);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const recargar = useCallback(async () => setIds(await leerNovedades()), []);

  const marcarVisto = useCallback(async (ticketId: string) => {
    await createClient().rpc('ticket_marcar_visto', { p_ticket: ticketId });
    setIds((prev) => {
      if (!prev.has(ticketId)) return prev;
      const siguiente = new Set(prev);
      siguiente.delete(ticketId);
      return siguiente;
    });
  }, []);

  const value = useMemo<NovedadSoporte>(() => ({ ids, hay: ids.size > 0, recargar, marcarVisto }), [ids, recargar, marcarVisto]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNovedadSoporte(): NovedadSoporte {
  return useContext(Ctx);
}
