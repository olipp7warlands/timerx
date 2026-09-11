'use client';

import { useState } from 'react';
import { useToast } from '@/components/empleado/compartido/Toast';
import { fmt } from '@/lib/horas/calendario';
import type { ImputacionPendiente } from '@/hooks/admin/useAprobacionImputaciones';

interface Props {
  pendientes: ImputacionPendiente[];
  loading: boolean;
  onAprobar: (id: string) => Promise<{ error: string | null }>;
  onRechazar: (id: string, motivo: string) => Promise<{ error: string | null }>;
  /** false en la ficha de usuario: ya se sabe de quién son, sobra la columna. */
  mostrarEmpleado?: boolean;
  mensajeVacio?: string;
}

/**
 * Bandeja de aprobación con rechazo-con-motivo obligatorio -- extraída de
 * ControlEscritorio.tsx (F5) para que la ficha de usuario la reutilice tal
 * cual, sin duplicar el flujo (el mock no tenía un patrón real de motivo que
 * copiar: su versión es un flip de estado sin justificación).
 */
export function TablaPendientesImputacion({ pendientes, loading, onAprobar, onRechazar, mostrarEmpleado = true, mensajeVacio = 'Nadie tiene imputaciones enviadas pendientes de aprobar.' }: Props) {
  const toast = useToast();
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  async function handleAprobar(id: string) {
    const { error } = await onAprobar(id);
    if (error) toast(error, 'error');
    else toast('Imputación aprobada');
  }

  async function handleConfirmarRechazo(id: string) {
    if (!motivoRechazo.trim()) return;
    const { error } = await onRechazar(id, motivoRechazo.trim());
    if (error) toast(error, 'error');
    else toast('Imputación rechazada');
    setRechazandoId(null);
    setMotivoRechazo('');
  }

  if (loading) return <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
  if (pendientes.length === 0) return <p className="p-4 text-sm text-ink-tertiary">{mensajeVacio}</p>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
          {mostrarEmpleado && <th className="border-b border-border px-2.5 py-2">Empleado</th>}
          <th className="border-b border-border px-2.5 py-2">Proyecto</th>
          <th className="border-b border-border px-2.5 py-2">Fecha</th>
          <th className="border-b border-border px-2.5 py-2 text-right">Horas</th>
          <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {pendientes.map((p) => (
          <tr key={p.id} className="hover:bg-subtle">
            {mostrarEmpleado && <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{p.empleadoNombre}</td>}
            <td className="border-b border-border px-2.5 py-2.5">
              {p.proyectoNombre}
              <span className="block text-[11px] font-normal text-ink-tertiary">{p.empresaDestino}</span>
            </td>
            <td className="mono border-b border-border px-2.5 py-2.5">{p.fecha}</td>
            <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(p.horas)}</td>
            <td className="border-b border-border px-2.5 py-2.5 text-right">
              {rechazandoId === p.id ? (
                <span className="flex items-center justify-end gap-1.5">
                  <input
                    className="input w-[220px]"
                    placeholder="Motivo del rechazo (obligatorio)"
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      setRechazandoId(null);
                      setMotivoRechazo('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" disabled={!motivoRechazo.trim()} onClick={() => handleConfirmarRechazo(p.id)}>
                    Confirmar rechazo
                  </button>
                </span>
              ) : (
                <>
                  <button type="button" className="btn-text" onClick={() => setRechazandoId(p.id)}>
                    Rechazar
                  </button>{' '}
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => handleAprobar(p.id)}>
                    Aprobar
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
