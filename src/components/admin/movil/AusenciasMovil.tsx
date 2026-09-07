'use client';

import { useAusenciasAdmin } from '@/hooks/admin/useAusenciasAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { rangoDias } from '@/lib/horas/calendario';

const ETIQUETA_TIPO: Record<string, string> = { vacaciones: 'Vacaciones', baja_medica: 'Baja médica', otro_permiso: 'Otro permiso' };

export function AusenciasMovil() {
  const { ausencias, loading, aprobar, rechazar } = useAusenciasAdmin();
  const toast = useToast();

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

  if (loading) return <p className="text-sm text-ink-tertiary">Cargando…</p>;

  return (
    <div>
      {ausencias.map((a) => (
        <div key={a.id} className={`card mb-2.5 p-3.5 ${a.estado === 'rechazada' ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between gap-2.5">
            <span>
              <b className={`text-sm font-extrabold ${a.estado === 'rechazada' ? 'text-ink-tertiary line-through' : ''}`}>{a.nombre}</b>
              <span className={`mt-0.5 block text-[11.5px] text-ink-tertiary ${a.estado === 'rechazada' ? 'line-through' : ''}`}>
                {ETIQUETA_TIPO[a.tipo] ?? a.tipo} · <span className="mono">{rangoDias(a.fechaInicio, a.fechaFin)}</span>
              </span>
            </span>
            {a.estado === 'pendiente' && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
                <span className="h-[7px] w-[7px] rounded-full border border-ink-primary" /> Pendiente
              </span>
            )}
            {a.estado === 'aprobada' && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
                <span className="h-[7px] w-[7px] rounded-full bg-ink-primary" /> Aprobada
              </span>
            )}
            {a.estado === 'rechazada' && <span className="text-xs font-bold text-ink-tertiary">Rechazada</span>}
          </div>
          {a.estado === 'pendiente' && (
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => onRechazar(a.id)}>
                Rechazar
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={() => onAprobar(a.id)}>
                Aprobar
              </button>
            </div>
          )}
        </div>
      ))}
      <p className="micro mt-1.5">Al aprobar, los días se bloquean en el registro del empleado y descuentan horas requeridas.</p>
    </div>
  );
}
