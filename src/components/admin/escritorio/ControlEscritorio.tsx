'use client';

import { useMemo, useState } from 'react';
import { useFaltantesAdmin } from '@/hooks/admin/useFaltantesAdmin';
import { useImputarDirecto } from '@/hooks/admin/useImputarDirecto';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useToast } from '@/components/empleado/compartido/Toast';
import { fmt } from '@/lib/horas/calendario';

export function ControlEscritorio() {
  const hoy = useMemo(() => new Date(), []);
  const desdeMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const hastaHoy = hoy.toISOString().slice(0, 10);

  const { faltantes, loading, recargar } = useFaltantesAdmin(desdeMes, hastaHoy);
  const { imputar } = useImputarDirecto();
  const { usuarios } = useUsuarios();
  const { proyectos } = useProyectosAdmin();
  const { categorias } = useCategorias();
  const toast = useToast();

  const [form, setForm] = useState({ empleadoId: '', proyectoId: '', subcategoriaId: '', fecha: '', horas: '' });

  const subcategorias = categorias.flatMap((c) => c.subcategorias.map((s) => ({ ...s, categoriaNombre: c.nombre })));

  function abrirImputacion(empleadoId: string, fecha: string) {
    setForm({ empleadoId, proyectoId: '', subcategoriaId: '', fecha, horas: '' });
  }

  async function guardarImputacion() {
    if (!form.empleadoId || !form.proyectoId || !form.subcategoriaId || !form.fecha || !form.horas) {
      toast('Completa empleado, proyecto, subcategoría, fecha y horas', 'error');
      return;
    }
    const { error } = await imputar({
      empleadoId: form.empleadoId,
      proyectoId: form.proyectoId,
      subcategoriaId: form.subcategoriaId,
      fecha: form.fecha,
      horas: Number(form.horas.replace(',', '.')),
    });
    if (error) {
      toast(error, 'error');
      return;
    }
    toast('Imputación directa registrada');
    setForm({ empleadoId: '', proyectoId: '', subcategoriaId: '', fecha: '', horas: '' });
    recargar();
  }

  return (
    <div className="split grid grid-cols-[300px_minmax(0,1fr)] items-start gap-4.5 max-[920px]:grid-cols-1">
      <div className="stack space-y-4">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Imputación directa</h2>
          </div>
          <div className="card-body space-y-1">
            <p className="text-xs text-ink-tertiary">Registra horas de cualquier empleado en una fecha concreta. Entra como aprobada.</p>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Empleado</label>
            <select className="input" value={form.empleadoId} onChange={(e) => setForm((f) => ({ ...f, empleadoId: e.target.value }))}>
              <option value="">Selecciona empleado</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Proyecto</label>
            <select className="input" value={form.proyectoId} onChange={(e) => setForm((f) => ({ ...f, proyectoId: e.target.value }))}>
              <option value="">Selecciona proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.empresaNombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Subcategoría</label>
            <select className="input" value={form.subcategoriaId} onChange={(e) => setForm((f) => ({ ...f, subcategoriaId: e.target.value }))}>
              <option value="">Selecciona subcategoría</option>
              {subcategorias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.categoriaNombre} · {s.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Fecha</label>
            <input className="input mono" type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Horas</label>
            <input className="input mono" value={form.horas} onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))} placeholder="7" />
            <button type="button" className="btn full" onClick={guardarImputacion}>
              Guardar imputación
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Imputaciones faltantes · este mes</h2>
          <button type="button" className="btn btn-sm" disabled title="Disponible al activar recordatorios">
            Recordar por email
          </button>
        </div>
        <div className="px-1.5 pb-2">
          {loading ? (
            <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>
          ) : faltantes.length === 0 ? (
            <p className="p-4 text-sm text-ink-tertiary">Nadie tiene imputaciones pendientes en este periodo.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Empleado</th>
                  <th className="border-b border-border px-2.5 py-2">Fecha</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Requerido</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Imputado</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Falta</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {faltantes.map((f) => (
                  <tr key={`${f.perfilId}-${f.fecha}`} className="hover:bg-subtle">
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">
                      {f.nombre}
                      <span className="block text-[11px] font-normal text-ink-tertiary">{f.email}</span>
                    </td>
                    <td className="mono border-b border-border px-2.5 py-2.5">{f.fecha}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(f.requerido)}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right text-ink-tertiary">{fmt(f.imputado)}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right font-extrabold">{fmt(f.falta)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right">
                      <button type="button" className="btn btn-sm" onClick={() => abrirImputacion(f.perfilId, f.fecha)}>
                        Imputar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">Solo días laborables sin ausencia aprobada. El cierre de mes exige que esta lista quede vacía.</p>
        </div>
      </div>
    </div>
  );
}
