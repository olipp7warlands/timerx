'use client';

import { useMemo, useState } from 'react';
import { useRefacturacion } from '@/hooks/admin/useRefacturacion';
import { useToast } from '@/components/empleado/compartido/Toast';
import { formatoMes } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

const CAT_COLOR: Record<string, string> = {
  Desarrollo: 'var(--cat-desarrollo)',
  Diseño: 'var(--cat-diseno)',
  Abogados: 'var(--cat-abogados)',
  Gestión: 'var(--cat-gestion)',
};

export function RefacturacionEscritorio({ info }: { info: AdminInfo }) {
  const hoy = useMemo(() => new Date(), []);
  const [anio, mes] = [hoy.getFullYear(), hoy.getMonth() + 1];
  const { lineas, loading, recargar, cerrarPeriodo } = useRefacturacion(anio, mes);
  const toast = useToast();
  const [cerrando, setCerrando] = useState(false);

  const totalImporte = lineas.reduce((s, l) => s + l.importe, 0);
  const totalHoras = lineas.reduce((s, l) => s + l.horas, 0);
  const horasSinTarifa = lineas.filter((l) => !l.tarifaCompleta).reduce((s, l) => s + l.horas, 0);

  async function onCerrar() {
    setCerrando(true);
    const { error } = await cerrarPeriodo(info.empresaId);
    setCerrando(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`Periodo ${mes}/${anio} cerrado`);
    recargar();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2">
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">
            {totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })} <small className="text-xs text-ink-tertiary">€</small>
          </p>
          <p className="micro mt-1">Importe estimado · mes</p>
        </div>
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">
            {totalHoras.toFixed(1).replace('.', ',')} <small className="text-xs text-ink-tertiary">h</small>
          </p>
          <p className="micro mt-1">Horas valoradas</p>
        </div>
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">
            {horasSinTarifa.toFixed(1).replace('.', ',')} <small className="text-xs text-ink-tertiary">h</small>
          </p>
          <p className="micro mt-1">Horas sin tarifa</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-extrabold">Abierto</p>
          <p className="micro mt-1">Estado del periodo</p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4.5 max-[1000px]:grid-cols-1">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Detalle por empresa y categoría</h2>
          </div>
          <div className="px-1.5 pb-2">
            {loading ? (
              <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                    <th className="border-b border-border px-2.5 py-2">Origen</th>
                    <th className="border-b border-border px-2.5 py-2">Destino</th>
                    <th className="border-b border-border px-2.5 py-2">Categoría</th>
                    <th className="border-b border-border px-2.5 py-2 text-right">Horas</th>
                    <th className="border-b border-border px-2.5 py-2 text-right">€/h</th>
                    <th className="border-b border-border px-2.5 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i} className="hover:bg-subtle">
                      <td className="border-b border-border px-2.5 py-2.5">{l.empresaOrigen}</td>
                      <td className="border-b border-border px-2.5 py-2.5">{l.empresaDestino}</td>
                      <td className="border-b border-border px-2.5 py-2.5">
                        <span className="mr-2 inline-block h-[7px] w-[7px] rounded-full" style={{ background: CAT_COLOR[l.categoria] ?? 'var(--ink-disabled)' }} />
                        {l.categoria}
                      </td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{l.horas.toFixed(1).replace('.', ',')}</td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{(l.importe / l.horas).toFixed(2)}</td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{l.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">Total</td>
                    <td className="border-b border-border px-2.5 py-2.5" />
                    <td className="border-b border-border px-2.5 py-2.5" />
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right font-extrabold">{totalHoras.toFixed(1).replace('.', ',')}</td>
                    <td className="border-b border-border px-2.5 py-2.5" />
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right font-extrabold">{totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                  </tr>
                </tbody>
              </table>
            )}
            <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
              Las tarifas por empleado tienen prioridad sobre la de su categoría. El proyecto Interno queda fuera por no refacturable.
            </p>
          </div>
        </div>

        <div className="stack space-y-4">
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Cierre de mes</h2>
            </div>
            <div className="card-body">
              <p className="text-xs text-ink-tertiary">El cierre bloquea todas las imputaciones del periodo y congela los importes.</p>
              <button type="button" className="btn btn-primary full" disabled={cerrando} onClick={onCerrar}>
                {cerrando ? 'Cerrando…' : `Cerrar ${formatoMes(mes).toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
