'use client';

import { useMemo, useState } from 'react';
import { useFichaProyecto, type PersonaHoras } from '@/hooks/admin/useFichaProyecto';
import { useAsignacionesProyecto, useAsignaciones } from '@/hooks/admin/useAsignaciones';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useToast } from '@/components/empleado/compartido/Toast';
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
  const { asignaciones, recargar: recargarAsig } = useAsignacionesProyecto(proyecto.id);
  const { asignar, finalizar } = useAsignaciones();
  const { usuarios } = useUsuarios();
  const toast = useToast();
  const nombreMes = useMemo(() => formatoMes(mes), [mes]);

  const [personaNueva, setPersonaNueva] = useState('');
  const [recienAsignados, setRecienAsignados] = useState<(PersonaHoras & { recienAsignada: true })[]>([]);
  const [finalizados, setFinalizados] = useState<Set<string>>(new Set());

  const hoyStr = new Date().toISOString().slice(0, 10);
  const idsVigentes = new Set(asignaciones.filter((a) => !a.hasta || a.hasta >= hoyStr).map((a) => a.empleadoId));
  const disponibles = usuarios.filter((u) => !idsVigentes.has(u.id));

  const personasActivas = ficha?.porPersona ?? [];
  const filasPersonas = [...personasActivas, ...recienAsignados.filter((r) => !personasActivas.some((p) => p.perfilId === r.perfilId))];

  async function onAnadirPersona() {
    const u = usuarios.find((x) => x.id === personaNueva);
    if (!u) return;
    const { error } = await asignar(u.id, proyecto.id);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`${u.nombre} asignado al proyecto`);
    setRecienAsignados((r) => [
      ...r,
      { perfilId: u.id, nombre: u.nombre, departamento: u.departamento, categoriaNombre: u.categoriaNombre ?? 'Sin categoría', horas: 0, recienAsignada: true },
    ]);
    setPersonaNueva('');
    recargarAsig();
  }

  async function onFinalizar(perfilId: string, nombre: string) {
    const { error } = await finalizar(perfilId, proyecto.id);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`${nombre} finalizado en el proyecto`);
    setFinalizados((s) => new Set(s).add(perfilId));
    recargarAsig();
  }

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
                    <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filasPersonas.map((p) => {
                    const finalizado = finalizados.has(p.perfilId);
                    return (
                      <tr key={`${p.perfilId}-${p.categoriaNombre}`} className={`hover:bg-subtle ${finalizado ? 'opacity-55' : ''}`}>
                        <td className="border-b border-border px-2.5 py-2.5 font-extrabold">
                          {p.nombre}
                          {'recienAsignada' in p && <span className="micro ml-1.5 font-normal text-ink-tertiary">· recién asignada</span>}
                        </td>
                        <td className="border-b border-border px-2.5 py-2.5">{p.departamento ?? '—'}</td>
                        <td className="border-b border-border px-2.5 py-2.5">
                          <span className="mr-2 inline-block h-[7px] w-[7px] rounded-full" style={{ background: CAT_COLOR[p.categoriaNombre] ?? 'var(--ink-disabled)' }} />
                          {p.categoriaNombre}
                        </td>
                        <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(p.horas)}</td>
                        <td className="mono border-b border-border px-2.5 py-2.5 text-right">{ficha.horasMes ? Math.round((p.horas / ficha.horasMes) * 100) : 0}%</td>
                        <td className="border-b border-border px-2.5 py-2.5 text-right">
                          {finalizado ? <span className="micro text-ink-tertiary">hasta hoy</span> : (
                            <button type="button" className="btn btn-sm" onClick={() => onFinalizar(p.perfilId, p.nombre)}>
                              Finalizar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-2 p-3">
                <select className="input max-w-[320px] flex-1" value={personaNueva} disabled={disponibles.length === 0} onChange={(e) => setPersonaNueva(e.target.value)}>
                  <option value="">{disponibles.length === 0 ? 'Sin personas disponibles' : 'Selecciona persona'}</option>
                  {disponibles.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} — {u.departamento ?? '—'} · {u.categoriaNombre ?? '—'}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary btn-sm" disabled={!personaNueva} onClick={onAnadirPersona}>
                  ＋ Añadir persona
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
