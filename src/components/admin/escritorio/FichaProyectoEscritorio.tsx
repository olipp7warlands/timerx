'use client';

import { useMemo } from 'react';
import { useFichaProyecto } from '@/hooks/admin/useFichaProyecto';
import { Donut } from '../compartido/Donut';
import { Hbar } from '../compartido/Hbar';
import { fmt, formatoMes } from '@/lib/horas/calendario';
import type { ProyectoAdmin } from '@/hooks/admin/useProyectosAdmin';

const CAT_COLOR: Record<string, string> = {
  Desarrollo: 'var(--cat-desarrollo)',
  Diseño: 'var(--cat-diseno)',
  Abogados: 'var(--cat-abogados)',
  Gestión: 'var(--cat-gestion)',
};

export function FichaProyectoEscritorio({ proyecto, anio, mes, onVolver }: { proyecto: ProyectoAdmin; anio: number; mes: number; onVolver: () => void }) {
  const { ficha, loading } = useFichaProyecto(proyecto.id, anio, mes);
  const nombreMes = useMemo(() => formatoMes(mes), [mes]);

  return (
    <div>
      <button type="button" className="btn btn-sm" onClick={onVolver}>
        ‹ Volver a proyectos
      </button>
      <div className="my-4 flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-extrabold">{proyecto.nombre}</h2>
        <span className="micro">
          {proyecto.empresaNombre} · {nombreMes}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-ink-tertiary">Cargando…</p>
      ) : !ficha || ficha.horasMes === 0 ? (
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-ink-tertiary">
              Sin actividad registrada en {nombreMes.toLowerCase()}. Cuando el proyecto reciba imputaciones, aquí verás sus horas, personas y departamentos.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2">
            <div className="card p-4">
              <p className="mono text-2xl font-extrabold">
                {fmt(ficha.horasMes)} <small className="text-xs text-ink-tertiary">h</small>
              </p>
              <p className="micro mt-1">Horas · {nombreMes}</p>
            </div>
            <div className="card p-4">
              <p className="mono text-2xl font-extrabold">
                {fmt(ficha.horasAcumuladoAnio)} <small className="text-xs text-ink-tertiary">h</small>
              </p>
              <p className="micro mt-1">Acumulado {anio}</p>
            </div>
            <div className="card p-4">
              <p className="mono text-2xl font-extrabold">{ficha.porPersona.length}</p>
              <p className="micro mt-1">Personas este mes</p>
            </div>
            <div className="card p-4">
              <p className="mono text-2xl font-extrabold">{ficha.refacturableMes.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
              <p className="micro mt-1">Refacturable · {nombreMes}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
            <div className="card">
              <div className="card-head">
                <h2 className="text-sm font-extrabold">Horas por categoría</h2>
              </div>
              <div className="card-body">
                <Donut
                  total={ficha.horasMes}
                  segmentos={ficha.porCategoria.map((c) => ({ etiqueta: c.nombre, valor: c.horas, color: CAT_COLOR[c.nombre] ?? 'var(--ink-disabled)' }))}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h2 className="text-sm font-extrabold">Departamentos</h2>
              </div>
              <div className="card-body">
                <Hbar filas={ficha.porDepartamento.map((d) => ({ etiqueta: d.departamento, valor: d.horas }))} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Personas en el proyecto</h2>
            </div>
            <div className="px-1.5 pb-2">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                    <th className="border-b border-border px-2.5 py-2">Nombre</th>
                    <th className="border-b border-border px-2.5 py-2">Departamento</th>
                    <th className="border-b border-border px-2.5 py-2">Categoría</th>
                    <th className="border-b border-border px-2.5 py-2 text-right">Horas</th>
                    <th className="border-b border-border px-2.5 py-2 text-right">% del proyecto</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.porPersona.map((p) => (
                    <tr key={`${p.perfilId}-${p.categoriaNombre}`} className="hover:bg-subtle">
                      <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{p.nombre}</td>
                      <td className="border-b border-border px-2.5 py-2.5">{p.departamento ?? '—'}</td>
                      <td className="border-b border-border px-2.5 py-2.5">
                        <span className="mr-2 inline-block h-[7px] w-[7px] rounded-full" style={{ background: CAT_COLOR[p.categoriaNombre] ?? 'var(--ink-disabled)' }} />
                        {p.categoriaNombre}
                      </td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(p.horas)}</td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{Math.round((p.horas / ficha.horasMes) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
