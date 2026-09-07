'use client';

import { useState } from 'react';
import { useAusenciasAdmin } from '@/hooks/admin/useAusenciasAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { rangoDias } from '@/lib/horas/calendario';

const ETIQUETA_TIPO: Record<string, string> = { vacaciones: 'Vacaciones', baja_medica: 'Baja médica', otro_permiso: 'Otro permiso' };
const ETIQUETA_ESTADO: Record<string, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' };

export function AusenciasEscritorio() {
  const { ausencias, loading, aprobar, rechazar } = useAusenciasAdmin();
  const toast = useToast();
  const [orden, setOrden] = useState<'pendientes' | 'recientes'>('pendientes');

  const ordenadas = [...ausencias].sort((a, b) => {
    if (orden === 'pendientes') {
      const rango = { pendiente: 0, aprobada: 1, rechazada: 2, cancelada: 2 };
      const diff = (rango[a.estado as keyof typeof rango] ?? 3) - (rango[b.estado as keyof typeof rango] ?? 3);
      if (diff !== 0) return diff;
    }
    return b.fechaInicio.localeCompare(a.fechaInicio);
  });

  async function onAprobar(id: string) {
    const { error } = await aprobar(id);
    if (error) toast(error, 'error');
    else toast('Ausencia aprobada');
  }

  async function onRechazar(id: string) {
    const { error } = await rechazar(id, 'Rechazada desde el panel de administración');
    if (error) toast(error, 'error');
    else toast('Ausencia rechazada');
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Solicitudes de ausencia</h2>
        <select className="input w-[180px]" value={orden} onChange={(e) => setOrden(e.target.value as 'pendientes' | 'recientes')}>
          <option value="pendientes">Pendientes primero</option>
          <option value="recientes">Más recientes</option>
        </select>
      </div>
      <div className="px-1.5 pb-2">
        {loading ? (
          <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                <th className="border-b border-border px-2.5 py-2">Empleado</th>
                <th className="border-b border-border px-2.5 py-2">Tipo</th>
                <th className="border-b border-border px-2.5 py-2">Fechas</th>
                <th className="border-b border-border px-2.5 py-2">Estado</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((a) => (
                <tr key={a.id} className={`hover:bg-subtle ${a.estado === 'rechazada' ? 'text-ink-tertiary line-through' : ''}`}>
                  <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{a.nombre}</td>
                  <td className="border-b border-border px-2.5 py-2.5">{ETIQUETA_TIPO[a.tipo] ?? a.tipo}</td>
                  <td className="mono border-b border-border px-2.5 py-2.5">{rangoDias(a.fechaInicio, a.fechaFin)}</td>
                  <td className="border-b border-border px-2.5 py-2.5">{ETIQUETA_ESTADO[a.estado] ?? a.estado}</td>
                  <td className="border-b border-border px-2.5 py-2.5 text-right">
                    {a.estado === 'pendiente' ? (
                      <>
                        <button type="button" className="btn-text" onClick={() => onRechazar(a.id)}>
                          Rechazar
                        </button>{' '}
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => onAprobar(a.id)}>
                          Aprobar
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-ink-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
          Al aprobarse, los días quedan bloqueados en el registro del empleado y cuentan como ausencia en el informe FTE.
        </p>
      </div>
    </div>
  );
}
