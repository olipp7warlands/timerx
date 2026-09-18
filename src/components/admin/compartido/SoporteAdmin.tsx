'use client';

import { useEffect, useState } from 'react';
import { ETIQUETA_TIPO_TICKET, fechaTicket, useTickets, type EstadoTicket } from '@/hooks/useSoporte';
import { useToast } from '@/components/empleado/compartido/Toast';
import { HiloTicket } from '@/components/soporte/HiloTicket';
import { PuntoEstadoTicket } from '@/components/soporte/PuntoEstadoTicket';
import { useNavAdmin } from '../NavAdmin';

const FILTROS: { id: 'todos' | EstadoTicket; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'abierto', etiqueta: 'Abiertos' },
  { id: 'en_curso', etiqueta: 'En curso' },
  { id: 'resuelto', etiqueta: 'Resueltos' },
];

interface Props {
  /** Admin móvil: misma spec en vertical (lista de tarjetas en vez de tabla). */
  movil?: boolean;
  /** Tras cambiar estado o responder: refresca el badge del sidebar/drawer. */
  onCambioEstado?: () => void;
}

/**
 * Sección Soporte del admin (Operación, tras Control): filtros de estado, tabla `row-link`, ficha con hilo,
 * responder (un ticket abierto pasa a en curso al responder: lo hace la BD) y Marcar en curso / resuelto / Reabrir.
 * `/admin/soporte` y `/admin/soporte/<id>`. La visibilidad y el permiso de cambiar estado los decide la RLS (018).
 */
export function SoporteAdmin({ movil = false, onCambioEstado }: Props) {
  const nav = useNavAdmin();
  const toast = useToast();
  const { tickets, loading, recargar, cambiarEstado } = useTickets();
  const [filtro, setFiltro] = useState<'todos' | EstadoTicket>('todos');

  // Ficha derivada de la URL. Con datos cargando se ESPERA (nunca se redirige al listado); solo si tras cargar el id
  // no existe (o la RLS no lo muestra) se vuelve al listado con aviso.
  const ticket = nav.fichaId ? tickets.find((t) => t.id === nav.fichaId) ?? null : null;
  const fichaInexistente = !!nav.fichaId && !loading && !ticket;
  useEffect(() => {
    if (!fichaInexistente) return;
    toast('Ese ticket no existe o no está en tu ámbito', 'error');
    nav.ir('soporte', { reemplazar: true });
  }, [fichaInexistente]); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcar(id: string, estado: EstadoTicket) {
    const { error } = await cambiarEstado(id, estado);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(estado === 'abierto' ? 'Ticket reabierto' : estado === 'en_curso' ? 'Ticket en curso' : 'Ticket resuelto');
    onCambioEstado?.();
  }

  if (nav.fichaId) {
    if (!ticket) return <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
    return (
      <div>
        <button type="button" className="btn btn-sm" onClick={() => nav.ir('soporte')}>
          ‹ Volver a soporte
        </button>
        <div className="mt-4">
          <HiloTicket
            ticket={ticket}
            modo="admin"
            onComentado={() => {
              recargar();
              onCambioEstado?.();
            }}
            acciones={
              <>
                {ticket.estado !== 'en_curso' && (
                  <button type="button" className="btn btn-sm" onClick={() => marcar(ticket.id, 'en_curso')}>
                    Marcar en curso
                  </button>
                )}
                {ticket.estado !== 'resuelto' ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => marcar(ticket.id, 'resuelto')}>
                    Marcar resuelto
                  </button>
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => marcar(ticket.id, 'abierto')}>
                    Reabrir
                  </button>
                )}
              </>
            }
          />
        </div>
      </div>
    );
  }

  const filas = tickets.filter((t) => filtro === 'todos' || t.estado === filtro);

  return (
    <div>
      <p className="mb-3.5 text-[12.5px] font-bold text-ink-tertiary">Incidencias, mejoras y consultas que el equipo envía desde su app. Responde y cambia el estado desde aquí.</p>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" className={`btn btn-sm ${filtro === f.id ? 'btn-primary' : ''}`} onClick={() => setFiltro(f.id)}>
            {f.etiqueta}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Tickets</h2>
          <span className="micro" data-testid="soporte-n">
            {filas.length} de {tickets.length}
          </span>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="p-4 text-sm text-ink-tertiary">No hay tickets con este filtro.</p>
        ) : movil ? (
          <div>
            {filas.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => nav.ir('soporte', { fichaId: t.id })}
                className="block w-full border-b border-border px-3.5 py-3 text-left"
                data-ref={t.ref}
              >
                <span className="flex items-baseline gap-2">
                  <span className="mono text-xs text-ink-tertiary">{t.ref}</span>
                  <span className="min-w-0 flex-1 text-sm font-extrabold leading-snug">{t.titulo}</span>
                </span>
                <span className="micro mt-1 flex flex-wrap items-center gap-x-1.5">
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-extrabold text-ink-secondary">{ETIQUETA_TIPO_TICKET[t.tipo]}</span>
                  <span>
                    {t.autorNombre} · {fechaTicket(t.creadoEn)}
                  </span>
                  <PuntoEstadoTicket estado={t.estado} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-1.5 pb-2">
            <table className="w-full border-collapse text-sm" data-testid="soporte-tabla">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Ref</th>
                  <th className="border-b border-border px-2.5 py-2">Título</th>
                  <th className="border-b border-border px-2.5 py-2">Tipo</th>
                  <th className="border-b border-border px-2.5 py-2">Autor</th>
                  <th className="border-b border-border px-2.5 py-2">Fecha</th>
                  <th className="border-b border-border px-2.5 py-2">Estado</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((t) => (
                  <tr
                    key={t.id}
                    className="row-link hover:bg-subtle"
                    data-ref={t.ref}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button')) nav.ir('soporte', { fichaId: t.id });
                    }}
                  >
                    <td className="mono border-b border-border px-2.5 py-2.5">{t.ref}</td>
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{t.titulo}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-extrabold text-ink-secondary">{ETIQUETA_TIPO_TICKET[t.tipo]}</span>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      {t.autorNombre} <span className="micro">· {t.empresaNombre}</span>
                    </td>
                    <td className="micro border-b border-border px-2.5 py-2.5">{fechaTicket(t.creadoEn)}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <PuntoEstadoTicket estado={t.estado} />
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right">
                      <button type="button" className="btn btn-sm" onClick={() => nav.ir('soporte', { fichaId: t.id })}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
