'use client';

import { useState } from 'react';
import { ETIQUETA_TIPO_TICKET, fechaTicket, useTicketHilo, type Ticket } from '@/hooks/useSoporte';
import { useToast } from '@/components/empleado/compartido/Toast';
import { PuntoEstadoTicket } from './PuntoEstadoTicket';

interface Props {
  ticket: Ticket;
  /** `admin`: responde y (con `acciones`) cambia el estado. `empleado`: solo comenta en SU hilo, sin tocar estados. */
  modo: 'admin' | 'empleado';
  /** Botones de estado (solo admin). */
  acciones?: React.ReactNode;
  /** Tras comentar: refresca la lista (un ticket abierto pasa a en curso al responder un admin). */
  onComentado: () => void;
}

/** Cabecera + descripción + conversación con caja de respuesta. Lo comparten el modal/hoja del empleado y la ficha admin. */
export function HiloTicket({ ticket, modo, acciones, onComentado }: Props) {
  const { mensajes, loading, comentar } = useTicketHilo(ticket.id);
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    const { error } = await comentar(texto);
    setEnviando(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    setTexto('');
    onComentado();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3.5">
        <div className="min-w-[220px] flex-1">
          <h3 className="text-[17px] font-extrabold leading-snug">
            <span className="mono mr-1.5 text-[12px] text-ink-tertiary">{ticket.ref}</span>
            {ticket.titulo}
          </h3>
          <p className="micro mt-1 flex flex-wrap items-center gap-x-1.5">
            <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-extrabold text-ink-secondary">{ETIQUETA_TIPO_TICKET[ticket.tipo]}</span>
            <span>
              · {ticket.autorNombre} · {ticket.empresaNombre} · {fechaTicket(ticket.creadoEn)} ·
            </span>
            <PuntoEstadoTicket estado={ticket.estado} />
          </p>
        </div>
        {acciones && <div className="flex gap-2">{acciones}</div>}
      </div>

      <div className="card mt-3.5">
        <div className="card-body">
          <p className="text-sm text-ink-secondary">{ticket.descripcion}</p>
        </div>
      </div>

      <div className="card mt-3.5">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Conversación</h2>
          <span className="micro">
            {mensajes.length} respuesta{mensajes.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="card-body">
          {loading && mensajes.length === 0 ? (
            <p className="text-xs text-ink-tertiary">Cargando…</p>
          ) : mensajes.length === 0 ? (
            <p className="text-xs text-ink-tertiary">Aún sin respuestas.</p>
          ) : (
            mensajes.map((m) => (
              <div key={m.id} className="border-b border-border py-2" data-testid="mensaje-ticket">
                <p className="micro mb-0.5">
                  <b className="text-ink-primary">{m.autorNombre}</b>
                  {m.autorEsAdmin && ' · Soporte'} · {fechaTicket(m.creadoEn)}
                </p>
                <p className="text-[13px] font-semibold text-ink-secondary">{m.texto}</p>
              </div>
            ))
          )}
          <div className="mt-3 flex items-start gap-2">
            <textarea
              className="input min-h-[64px] flex-1 resize-y"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={modo === 'admin' ? `Escribe una respuesta para ${ticket.autorNombre.split(' ')[0]}…` : 'Añade un comentario…'}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={enviando || !texto.trim()} onClick={enviar}>
              {modo === 'admin' ? 'Responder' : 'Comentar'}
            </button>
          </div>
          <p className="foot mt-2 text-xs text-ink-tertiary">
            {modo === 'admin' ? 'El autor ve la respuesta y el estado desde Soporte en su app.' : 'Si tu problema ya se resolvió, dilo aquí: solo el equipo de soporte cambia el estado.'}
          </p>
        </div>
      </div>
    </div>
  );
}
