'use client';

import { useMemo, useState } from 'react';
import { useResumenDia } from '@/hooks/admin/useResumenDia';
import { useResumenMes } from '@/hooks/admin/useResumenMes';
import { useHorasPorEmpresaYProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useRefacturacion } from '@/hooks/admin/useRefacturacion';
import { Hbar } from '../compartido/Hbar';
import { Donut } from '../compartido/Donut';
import { fmt } from '@/lib/horas/calendario';

const GRISES = ['var(--ink-primary)', 'var(--ink-secondary)', 'var(--ink-tertiary)', 'var(--ink-disabled)', 'var(--border-strong)'];

function sumarDias(fecha: string, delta: number) {
  const d = new Date(fecha + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function InicioMovil() {
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fechaDia, setFechaDia] = useState(hoy);
  const [anioMes, setAnioMes] = useState(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  const { resumen: dia } = useResumenDia(fechaDia);
  const { resumen: mes } = useResumenMes(anioMes.anio, anioMes.mes);
  const { porEmpresa, porProyecto } = useHorasPorEmpresaYProyecto(anioMes.anio, anioMes.mes);
  const { lineas: refact } = useRefacturacion(anioMes.anio, anioMes.mes);

  function cambiarMes(delta: number) {
    setAnioMes(({ anio, mes: m }) => {
      const d = new Date(anio, m - 1 + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  }

  const nombreDia = new Date(fechaDia + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const nombreMes = new Date(anioMes.anio, anioMes.mes - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const totalRefact = refact.reduce((s, l) => s + l.importe, 0);

  return (
    <div>
      <div className="card mb-3 flex items-center justify-between gap-2.5 p-3">
        <button type="button" className="grid h-[38px] w-[38px] place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => setFechaDia((f) => sumarDias(f, -1))}>
          ‹
        </button>
        <div className="text-center">
          <p className="text-base font-extrabold capitalize">{nombreDia}</p>
          <p className="micro mt-0.5">{fechaDia === hoy ? 'Hoy' : ''}</p>
        </div>
        <button type="button" className="grid h-[38px] w-[38px] place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => setFechaDia((f) => sumarDias(f, 1))}>
          ›
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="card p-3.5">
          <p className="mono text-xl font-extrabold">{dia?.alDia ?? '…'}</p>
          <p className="micro mt-0.5">de {dia?.totalEmpleados ?? 0} al día</p>
        </div>
        <div className="card p-3.5">
          <p className="mono text-xl font-extrabold">{dia?.sinImputar ?? '…'}</p>
          <p className="micro mt-0.5">sin imputar</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
          <h2 className="text-sm font-extrabold">Pendientes de imputar</h2>
        </div>
        <div className="px-3.5 py-1.5">
          {(dia?.pendientes ?? []).length === 0 ? (
            <p className="py-2 text-xs text-ink-tertiary">Nadie pendiente.</p>
          ) : (
            dia!.pendientes.map((p) => (
              <div key={p.nombre} className="flex items-center justify-between border-b border-border py-2.5 text-[13px] last:border-b-0">
                <span className="font-bold">{p.nombre}</span>
                <span className="mono text-xs text-ink-tertiary">
                  {fmt(p.imputado)} / {fmt(p.requerido)} h
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
          <h2 className="text-sm font-extrabold">Ausentes</h2>
        </div>
        <div className="px-3.5 py-1.5">
          {(dia?.ausentes ?? []).length === 0 ? (
            <p className="py-2 text-xs text-ink-tertiary">Nadie ausente este día.</p>
          ) : (
            dia!.ausentes.map((a) => (
              <div key={a.nombre} className="flex items-center justify-between border-b border-border py-2.5 text-[13px] last:border-b-0">
                <span className="font-bold">{a.nombre}</span>
                <span className="text-xs text-ink-tertiary">{a.tipo}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="sec-label mb-2.5 mt-6 text-[15.5px] font-extrabold">Resumen del mes</p>
      <div className="card mb-3 flex items-center justify-between gap-2.5 p-3">
        <button type="button" className="grid h-[38px] w-[38px] place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => cambiarMes(-1)}>
          ‹
        </button>
        <p className="text-base font-extrabold capitalize">{nombreMes}</p>
        <button type="button" className="grid h-[38px] w-[38px] place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => cambiarMes(1)}>
          ›
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="card p-3.5">
          <p className="mono text-xl font-extrabold">{mes ? fmt(mes.horasImputadasTotal) : '…'}</p>
          <p className="micro mt-0.5">h imputadas</p>
        </div>
        <div className="card p-3.5">
          <p className="mono text-xl font-extrabold">{mes?.alDia ?? '…'}</p>
          <p className="micro mt-0.5">de {mes?.totalEmpleados ?? 0} al día</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="border-b border-border px-3.5 py-3">
          <h2 className="text-sm font-extrabold">Horas por empresa</h2>
        </div>
        <div className="p-3.5">
          <Hbar filas={porEmpresa.map((e) => ({ etiqueta: e.empresaNombre, valor: e.horas }))} />
        </div>
      </div>

      <div className="card mb-3">
        <div className="border-b border-border px-3.5 py-3">
          <h2 className="text-sm font-extrabold">Horas por proyecto</h2>
        </div>
        <div className="p-3.5">
          <Donut
            total={porProyecto.reduce((s, p) => s + p.horas, 0)}
            segmentos={porProyecto.slice(0, 5).map((p, i) => ({ etiqueta: p.proyectoNombre, valor: p.horas, color: GRISES[i % GRISES.length] }))}
          />
        </div>
      </div>

      <div className="card">
        <div className="border-b border-border px-3.5 py-3">
          <h2 className="text-sm font-extrabold">Refacturación estimada</h2>
        </div>
        <div className="p-3.5">
          <p className="mono text-xl font-extrabold">
            {totalRefact.toLocaleString('es-ES', { minimumFractionDigits: 2 })} <small className="text-xs text-ink-tertiary">€</small>
          </p>
        </div>
      </div>
    </div>
  );
}
