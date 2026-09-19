'use client';

import { hoyMadrid } from '@/lib/fechas';
import { useEffect, useMemo, useState } from 'react';
import { useFaltantesAdmin } from '@/hooks/admin/useFaltantesAdmin';
import { useImputarDirecto } from '@/hooks/admin/useImputarDirecto';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useAsignacionesEmpleado } from '@/hooks/admin/useAsignacionesEmpleado';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useAprobacionImputaciones } from '@/hooks/admin/useAprobacionImputaciones';
import { useDescripcionObligatoria } from '@/hooks/useDescripcionObligatoria';
import { enviarRecordatoriosManual } from '@/app/admin/actions';
import { useToast } from '@/components/empleado/compartido/Toast';
import { TablaPendientesImputacion } from '../compartido/TablaPendientesImputacion';
import { useNavAdmin } from '../NavAdmin';
import { fmt } from '@/lib/horas/calendario';
import { puedeImputarDirecto } from '@/lib/usuarios/permisos';
import type { AdminInfo } from '../types';

export function ControlEscritorio({ info }: { info: AdminInfo }) {
  const nav = useNavAdmin();
  const hoy = useMemo(() => new Date(), []);
  const desdeMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const hastaHoy = hoyMadrid();

  const { faltantes, loading, recargar } = useFaltantesAdmin(desdeMes, hastaHoy);
  const { imputar } = useImputarDirecto();
  const { usuarios: todosUsuarios } = useUsuarios();
  const { proyectos: todosProyectos } = useProyectosAdmin();
  // Imputación directa (RPC `imputar_directo`, 024): un admin_empresa solo con empleado Y proyecto de SU empresa; los selectores lo reflejan.
  const usuarios = todosUsuarios.filter((u) => puedeImputarDirecto(info, u.empresaId));
  const proyectos = todosProyectos.filter((p) => puedeImputarDirecto(info, info.empresaId, p.empresaId));
  const { categorias } = useCategorias();
  const { pendientes, loading: loadingPendientes, aprobar, rechazar } = useAprobacionImputaciones();
  const descripcionObligatoria = useDescripcionObligatoria();
  const toast = useToast();

  // Hand-off efímero `?empleado=<id>` (imputación directa desde la ficha): la sección se monta al llegar, así que
  // basta con leerlo como valor inicial; después se limpia de la URL para que atrás/adelante no lo re-apliquen.
  const empleadoPreseleccionado = nav.consulta.get('empleado');
  const [form, setForm] = useState({ empleadoId: empleadoPreseleccionado ?? '', proyectoId: '', subcategoriaId: '', fecha: '', horas: '', descripcion: '' });
  const { limpiarConsulta } = nav;
  useEffect(() => {
    if (empleadoPreseleccionado) limpiarConsulta();
  }, [empleadoPreseleccionado, limpiarConsulta]);
  const { proyectoIdsParaFecha } = useAsignacionesEmpleado(form.empleadoId);
  const [enviandoRecordatorios, setEnviandoRecordatorios] = useState(false);

  // Un `?empleado=` de fuera del ámbito (hand-off desde una ficha ajena) se trata como no seleccionado.
  const empleadoIdEfectivo = usuarios.some((u) => u.id === form.empleadoId) ? form.empleadoId : '';
  const empleadoSeleccionado = usuarios.find((u) => u.id === empleadoIdEfectivo);
  const categoriasFiltradas = empleadoSeleccionado?.departamentoId
    ? categorias.filter((c) => !c.departamentoId || c.departamentoId === empleadoSeleccionado.departamentoId)
    : categorias;
  const subcategorias = categoriasFiltradas.flatMap((c) => c.subcategorias.map((s) => ({ ...s, categoriaNombre: c.nombre })));
  const idsVigentes = proyectoIdsParaFecha(form.fecha);
  const proyectosDisponibles = proyectos.filter((p) => idsVigentes.includes(p.id));
  // Si el empleado/fecha cambian y el proyecto elegido deja de ser válido, se trata como
  // no seleccionado en vez de guardar el id obsoleto en el estado (evita setState en efecto).
  const proyectoIdEfectivo = idsVigentes.includes(form.proyectoId) ? form.proyectoId : '';

  function abrirImputacion(empleadoId: string, fecha: string) {
    setForm({ empleadoId, proyectoId: '', subcategoriaId: '', fecha, horas: '', descripcion: '' });
  }

  async function guardarImputacion() {
    if (!empleadoIdEfectivo || !proyectoIdEfectivo || !form.subcategoriaId || !form.fecha || !form.horas) {
      toast('Completa empleado, proyecto, subcategoría, fecha y horas', 'error');
      return;
    }
    if (descripcionObligatoria && !form.descripcion.trim()) {
      toast('Completa la descripción', 'error');
      return;
    }
    const { error } = await imputar({
      empleadoId: empleadoIdEfectivo,
      proyectoId: proyectoIdEfectivo,
      subcategoriaId: form.subcategoriaId,
      fecha: form.fecha,
      horas: Number(form.horas.replace(',', '.')),
      descripcion: form.descripcion || undefined,
    });
    if (error) {
      toast(error, 'error');
      return;
    }
    toast('Imputación directa registrada');
    setForm({ empleadoId: '', proyectoId: '', subcategoriaId: '', fecha: '', horas: '', descripcion: '' });
    recargar();
  }

  async function onEnviarRecordatorios() {
    setEnviandoRecordatorios(true);
    const { error, procesados, omitidos } = await enviarRecordatoriosManual();
    setEnviandoRecordatorios(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(procesados === 0 ? 'Nadie con recordatorio pendiente' : `${procesados} recordatorio${procesados === 1 ? '' : 's'} enviado${procesados === 1 ? '' : 's'}${omitidos ? ` (${omitidos} ya recibidos hoy)` : ''}`);
  }

  return (
    <div className="space-y-4">
    <div className="split grid grid-cols-[300px_minmax(0,1fr)] items-start gap-4.5 max-[920px]:grid-cols-1">
      <div className="stack space-y-4">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Imputación directa</h2>
          </div>
          <div className="card-body space-y-1">
            <p className="text-xs text-ink-tertiary">{info.rol === 'admin_grupo' ? 'Registra horas de cualquier empleado en una fecha concreta. Entra como aprobada.' : 'Registra horas de empleados de tu empresa en proyectos de tu empresa. Entra como aprobada; el resto de casos van por el flujo normal (el empleado computa y aprueba la empresa destino).'}</p>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Empleado</label>
            <select className="input" value={empleadoIdEfectivo} onChange={(e) => setForm((f) => ({ ...f, empleadoId: e.target.value }))}>
              <option value="">Selecciona empleado</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Proyecto</label>
            {empleadoIdEfectivo && proyectosDisponibles.length === 0 ? (
              <p className="text-xs text-ink-tertiary">Este empleado no tiene proyectos asignados para esta fecha.</p>
            ) : (
              <select className="input" value={proyectoIdEfectivo} onChange={(e) => setForm((f) => ({ ...f, proyectoId: e.target.value }))}>
                <option value="">Selecciona proyecto</option>
                {proyectosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.empresaNombre}
                  </option>
                ))}
              </select>
            )}
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
            {descripcionObligatoria && (
              <>
                <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Descripción</label>
                <input className="input" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción (obligatoria)" />
              </>
            )}
            <button type="button" className="btn full mt-3" onClick={guardarImputacion}>
              Guardar imputación
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Imputaciones faltantes · este mes</h2>
          <button type="button" className="btn btn-sm" disabled={enviandoRecordatorios} onClick={onEnviarRecordatorios}>
            {enviandoRecordatorios ? 'Enviando…' : 'Recordar por email'}
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
                  <tr
                    key={`${f.perfilId}-${f.fecha}`}
                    className="row-link hover:bg-subtle"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button')) nav.ir('usuarios', { fichaId: f.perfilId });
                    }}
                  >
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

    <div className="card">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Aprobación de imputaciones</h2>
      </div>
      <div className="px-1.5 pb-2">
        <TablaPendientesImputacion
          pendientes={pendientes}
          loading={loadingPendientes}
          onAprobar={aprobar}
          onRechazar={rechazar}
          puedeResolver={(p) => info.rol === 'admin_grupo' || p.empresaDestinoId === info.empresaId}
        />
        <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">Aprueba la empresa destino del proyecto (o admin de grupo) — quien recibe el trabajo.</p>
      </div>
    </div>
    </div>
  );
}
