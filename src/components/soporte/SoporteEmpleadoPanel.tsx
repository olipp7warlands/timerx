'use client';

import { useState } from 'react';
import { ETIQUETA_TIPO_TICKET, fechaTicket, useTickets, type TipoTicket } from '@/hooks/useSoporte';
import { useToast } from '@/components/empleado/compartido/Toast';
import { HiloTicket } from './HiloTicket';
import { PuntoEstadoTicket } from './PuntoEstadoTicket';

type Vista = { tipo: 'lista' } | { tipo: 'nuevo' } | { tipo: 'ticket'; id: string };

/**
 * Soporte del lado empleado (página `/soporte`, accesible desde el menú del avatar en los dos shells). Sin mock:
 * la spec del combinado 5+2 es la fuente de verdad. Ve SOLO sus tickets (RLS + `.eq('creado_por')` explícito: un admin ve todos por RLS pero aquí solo los suyos), abre uno nuevo, lee el hilo y
 * comenta. NO cambia estados: si su problema se resolvió, lo dice en el hilo.
 */
export function SoporteEmpleadoPanel() {
  const { tickets, loading, recargar, crear } = useTickets({ soloMios: true });
  const toast = useToast();
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [form, setForm] = useState<{ tipo: TipoTicket; titulo: string; descripcion: string }>({ tipo: 'incidencia', titulo: '', descripcion: '' });
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      toast('Título y descripción son obligatorios', 'error');
      return;
    }
    setEnviando(true);
    const { error, ref } = await crear(form);
    setEnviando(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`Ticket ${ref} creado`);
    setForm({ tipo: 'incidencia', titulo: '', descripcion: '' });
    setVista({ tipo: 'lista' });
  }

  if (vista.tipo === 'nuevo') {
    return (
      <div>
        <button type="button" className="btn btn-sm" onClick={() => setVista({ tipo: 'lista' })}>
          ‹ Mis tickets
        </button>
        <label className="mb-1 mt-3.5 block text-xs font-extrabold text-ink-tertiary">Tipo</label>
        <select className="input" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoTicket }))}>
          {(Object.keys(ETIQUETA_TIPO_TICKET) as TipoTicket[]).map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_TICKET[t]}
            </option>
          ))}
        </select>
        <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Título</label>
        <input className="input" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Resumen en una línea" />
        <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Descripción</label>
        <textarea
          className="input min-h-[110px] resize-y"
          value={form.descripcion}
          onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          placeholder="Qué pasó, qué esperabas y en qué pantalla"
        />
        <button type="button" className="btn btn-primary full mt-3.5 w-full justify-center" disabled={enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : 'Enviar ticket'}
        </button>
      </div>
    );
  }

  if (vista.tipo === 'ticket') {
    const t = tickets.find((x) => x.id === vista.id);
    return (
      <div>
        <button type="button" className="btn btn-sm mb-3.5" onClick={() => setVista({ tipo: 'lista' })}>
          ‹ Mis tickets
        </button>
        {t ? <HiloTicket ticket={t} modo="empleado" onComentado={recargar} /> : <p className="text-sm text-ink-tertiary">Ticket no encontrado.</p>}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setVista({ tipo: 'nuevo' })}>
        ＋ Nuevo ticket
      </button>
      <div className="mt-3.5" data-testid="soporte-lista">
        {loading ? (
          <p className="text-sm text-ink-tertiary">Cargando…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-ink-tertiary">Aún no has abierto ningún ticket. Cuéntanos una incidencia, una mejora o una duda.</p>
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setVista({ tipo: 'ticket', id: t.id })}
              className="flex w-full items-center gap-2.5 border-b border-border py-2.5 text-left hover:bg-subtle"
              data-ref={t.ref}
            >
              <span className="mono w-[54px] shrink-0 text-xs text-ink-tertiary">{t.ref}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{t.titulo}</span>
                <span className="micro">{fechaTicket(t.creadoEn)}</span>
              </span>
              <PuntoEstadoTicket estado={t.estado} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
