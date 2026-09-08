'use client';

import { useMemo, useState } from 'react';
import { useResumenDia } from '@/hooks/admin/useResumenDia';
import { useResumenMes } from '@/hooks/admin/useResumenMes';
import { useHorasPorEmpresaYProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useRefacturacion } from '@/hooks/admin/useRefacturacion';
import { useDiasMes } from '@/hooks/useDiasMes';
import { CalendarGrid } from '@/components/empleado/compartido/CalendarGrid';
import { Kpi } from '../compartido/Kpi';
import { Donut } from '../compartido/Donut';
import { fmt, formatoDiaLargo, formatoMesAnio } from '@/lib/horas/calendario';
import { IconHoy, IconCalendario } from '@/components/ui/icons';
import type { AdminInfo, SeccionAdmin } from '../types';

const GRISES = ['var(--ink-primary)', 'var(--ink-secondary)', 'var(--ink-tertiary)', 'var(--ink-disabled)', 'var(--border-strong)'];

function sumarDias(fecha: string, delta: number) {
  const d = new Date(fecha + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function InicioEscritorio({ info, onIrA }: { info: AdminInfo; onIrA: (s: SeccionAdmin) => void }) {
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fechaDia, setFechaDia] = useState(hoy);
  const [anioMes, setAnioMes] = useState(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  const { resumen: dia, loading: diaLoading } = useResumenDia(fechaDia);
  const { resumen: mes, loading: mesLoading } = useResumenMes(anioMes.anio, anioMes.mes);
  const { porEmpresa, porProyecto } = useHorasPorEmpresaYProyecto(anioMes.anio, anioMes.mes);
  const { lineas: refact } = useRefacturacion(anioMes.anio, anioMes.mes);
  const { dias } = useDiasMes(anioMes.anio, anioMes.mes, info.empresaId);

  const totalRefact = refact.reduce((s, l) => s + l.importe, 0);

  function cambiarMes(delta: number) {
    setAnioMes(({ anio, mes }) => {
      const d = new Date(anio, mes - 1 + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  }

  const nombreMes = formatoMesAnio(anioMes.anio, anioMes.mes);
  const nombreDia = formatoDiaLargo(fechaDia);

  return (
    <div className="space-y-8">
      <div>
        <p className="sec-label mb-3 flex items-center gap-2 text-[15.5px] font-extrabold">
          <IconHoy size={17} />
          Seguimiento del día
        </p>
        <div className="card day-nav-card mb-3.5 flex items-center justify-between p-3 px-4">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => setFechaDia((f) => sumarDias(f, -1))}>
            ‹
          </button>
          <div className="text-center">
            <p className="text-[16.5px] font-extrabold">{nombreDia}</p>
            <p className="micro mt-0.5">{fechaDia === hoy ? 'Hoy' : ''}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => setFechaDia((f) => sumarDias(f, 1))}>
            ›
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_370px] items-start gap-3.5 max-[1000px]:grid-cols-1">
          <div>
            <div className="mb-3.5 grid grid-cols-2 gap-3.5">
              <Kpi valor={diaLoading ? '…' : String(dia?.alDia ?? 0)} etiqueta="Al día" estado={`de ${dia?.totalEmpleados ?? 0} personas`} />
              <Kpi valor={diaLoading ? '…' : String(dia?.sinImputar ?? 0)} etiqueta="Sin imputar" puntoLleno={false} estado={`${dia?.conAusencia ?? 0} con ausencia aprobada`} />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="card">
                <div className="card-head py-3 px-4">
                  <h2 className="text-sm font-extrabold">Pendientes de imputar</h2>
                  <button type="button" className="btn btn-sm" disabled title="Disponible al activar recordatorios">
                    Recordar
                  </button>
                </div>
                <div className="space-y-2 px-4 pb-3.5 pt-1">
                  {(dia?.pendientes ?? []).length === 0 ? (
                    <p className="text-xs text-ink-tertiary">Nadie pendiente.</p>
                  ) : (
                    dia!.pendientes.slice(0, 6).map((p) => (
                      <div key={p.nombre} className="flex items-center justify-between text-xs">
                        <span className="font-bold">{p.nombre}</span>
                        <span className="mono text-ink-tertiary">
                          {fmt(p.imputado)}/{fmt(p.requerido)} h
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-head py-3 px-4">
                  <h2 className="text-sm font-extrabold">Ausentes</h2>
                  <button type="button" className="btn btn-sm" onClick={() => onIrA('ausencias')}>
                    Ausencias ›
                  </button>
                </div>
                <div className="space-y-2 px-4 pb-3.5 pt-1">
                  {(dia?.ausentes ?? []).length === 0 ? (
                    <p className="text-xs text-ink-tertiary">Nadie ausente hoy.</p>
                  ) : (
                    dia!.ausentes.map((a) => (
                      <div key={a.nombre} className="flex items-center justify-between text-xs">
                        <span className="font-bold">{a.nombre}</span>
                        <span className="text-ink-tertiary">{a.tipo}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Calendario</h2>
              <span className="flex items-center gap-2">
                <button type="button" className="collapse-btn grid h-6 w-6 place-items-center rounded-md border border-border text-ink-tertiary" onClick={() => cambiarMes(-1)}>
                  ‹
                </button>
                <span className="micro">{nombreMes}</span>
                <button type="button" className="collapse-btn grid h-6 w-6 place-items-center rounded-md border border-border text-ink-tertiary" onClick={() => cambiarMes(1)}>
                  ›
                </button>
              </span>
            </div>
            <CalendarGrid dias={dias} estadoDia={(d) => (d.fecha === fechaDia ? 'completo' : d.fecha > hoy ? 'futuro' : 'incompleto')} onClickDia={setFechaDia} />
            <div className="mt-3 flex gap-4 text-xs text-ink-tertiary">
              <span className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full bg-ink-primary" /> Seleccionado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full border border-ink-primary" /> Laborable
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full bg-ink-disabled" /> Futuro
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="sec-label mb-3 flex items-center gap-2 text-[15.5px] font-extrabold">
          <IconCalendario size={17} />
          Resumen del mes
        </p>
        <div className="card day-nav-card mb-3.5 flex items-center justify-between p-3 px-4">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => cambiarMes(-1)}>
            ‹
          </button>
          <div className="text-center">
            <p className="text-[16.5px] font-extrabold">{nombreMes}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-subtle text-lg" onClick={() => cambiarMes(1)}>
            ›
          </button>
        </div>
        <div className="mb-3.5 grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2">
          <Kpi valor={mesLoading ? '…' : String(mes?.alDia ?? 0)} etiqueta="Al día" estado={`de ${mes?.totalEmpleados ?? 0} personas`} />
          <Kpi valor={mesLoading ? '…' : String(mes?.sinImputar ?? 0)} etiqueta="Sin imputar" puntoLleno={false} />
          <Kpi valor={mesLoading ? '…' : fmt(mes?.horasImputadasTotal ?? 0)} unidad="h" etiqueta="Horas imputadas" />
          <Kpi valor={mesLoading ? '…' : fmt(mes?.horasRequeridasTotal ?? 0)} unidad="h" etiqueta="Horas requeridas" />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Horas por empresa</h2>
              <button type="button" className="btn btn-sm" onClick={() => onIrA('empresas')}>
                Empresas ›
              </button>
            </div>
            <div className="card-body">
              <Donut total={porEmpresa.reduce((s, e) => s + e.horas, 0)} segmentos={porEmpresa.map((e, i) => ({ etiqueta: e.empresaNombre, valor: e.horas, color: GRISES[i % GRISES.length] }))} />
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Horas por proyecto</h2>
              <button type="button" className="btn btn-sm" onClick={() => onIrA('proyectos')}>
                Proyectos ›
              </button>
            </div>
            <div className="card-body">
              <Donut
                total={porProyecto.reduce((s, p) => s + p.horas, 0)}
                segmentos={porProyecto.slice(0, 6).map((p, i) => ({ etiqueta: p.proyectoNombre, valor: p.horas, color: GRISES[i % GRISES.length] }))}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Refacturación estimada</h2>
              <button type="button" className="btn btn-sm" onClick={() => onIrA('refacturacion')}>
                Refacturaciones ›
              </button>
            </div>
            <div className="card-body">
              <p className="mono text-2xl font-extrabold">
                {totalRefact.toLocaleString('es-ES', { minimumFractionDigits: 2 })} <small className="text-xs text-ink-tertiary">€</small>
              </p>
              <p className="micro mt-1">{refact.length} líneas de detalle</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
