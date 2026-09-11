'use client';

import { useMemo, useState } from 'react';
import type { UsuarioAdmin, ActualizarUsuarioInput } from '@/hooks/admin/useUsuarios';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useDepartamentos } from '@/hooks/admin/useDepartamentos';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useAsignacionesEmpleado } from '@/hooks/admin/useAsignacionesEmpleado';
import { useAsignaciones } from '@/hooks/admin/useAsignaciones';
import { useAprobacionImputaciones } from '@/hooks/admin/useAprobacionImputaciones';
import { useAusenciasAdmin } from '@/hooks/admin/useAusenciasAdmin';
import { useFichaUsuario } from '@/hooks/admin/useFichaUsuario';
import { useBalanceMesEmpleado } from '@/hooks/admin/useBalanceMesEmpleado';
import { enviarRecordatorioEmpleado } from '@/app/admin/actions';
import { useToast } from '@/components/empleado/compartido/Toast';
import { TablaPendientesImputacion } from '../compartido/TablaPendientesImputacion';
import { confirmar } from '@/components/ui/confirmar';
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/auth/roles';
import { fmt, formatoMes } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

const ETIQUETA_TIPO_AUSENCIA: Record<string, string> = { vacaciones: 'Vacaciones', baja_medica: 'Baja médica', otro_permiso: 'Otro permiso' };

interface Props {
  info: AdminInfo;
  usuario: UsuarioAdmin;
  onVolver: () => void;
  onIrAControl: (empleadoId: string) => void;
  onActualizar: (id: string, input: ActualizarUsuarioInput) => Promise<{ error: string | null }>;
  onDesactivar: (id: string) => Promise<{ error: string | null }>;
}

export function FichaUsuarioEscritorio({ info, usuario, onVolver, onIrAControl, onActualizar, onDesactivar }: Props) {
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const nombreMes = formatoMes(mes);
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const puedeEditar = esAdminGrupo || usuario.empresaId === info.empresaId;

  const { empresas } = useEmpresas();
  const { departamentos } = useDepartamentos();
  const { categorias } = useCategorias();
  const { proyectos } = useProyectosAdmin();
  const { balance, loading: loadingBalance } = useBalanceMesEmpleado(usuario.id, anio, mes);
  const { porProyecto, ultimas, loading: loadingFicha } = useFichaUsuario(usuario.id, anio, mes);
  const { asignaciones, loading: loadingAsig, recargar: recargarAsig } = useAsignacionesEmpleado(usuario.id);
  const { asignar, finalizar } = useAsignaciones();
  const { pendientes, loading: loadingPendientesTodos, aprobar, rechazar } = useAprobacionImputaciones();
  const { ausencias, loading: loadingAusenciasTodas, aprobar: aprobarAusencia, rechazar: rechazarAusencia } = useAusenciasAdmin();

  const pendientesUsuario = pendientes.filter((p) => p.empleadoId === usuario.id);
  const ausenciasUsuario = ausencias.filter((a) => a.perfilId === usuario.id);
  const diasAusenciaMes = (balance?.diasVacaciones ?? 0) + (balance?.diasBaja ?? 0) + (balance?.diasPermiso ?? 0);

  const [proyectoNuevo, setProyectoNuevo] = useState('');
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState({
    empresaId: usuario.empresaId,
    departamentoId: usuario.departamentoId ?? '',
    categoriaId: usuario.categoriaId ?? '',
    rol: usuario.rol as RolUsuario,
  });
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false);

  const hoyStr = hoy.toISOString().slice(0, 10);
  const asignacionesVigentes = asignaciones.filter((a) => !a.hasta || a.hasta >= hoyStr);
  const idsAsignados = new Set(asignacionesVigentes.map((a) => a.proyectoId));
  const proyectosDisponibles = proyectos.filter((p) => !idsAsignados.has(p.id));

  async function onAsignar() {
    if (!proyectoNuevo) return;
    const { error } = await asignar(usuario.id, proyectoNuevo);
    if (error) toast(error, 'error');
    else {
      toast('Proyecto asignado');
      setProyectoNuevo('');
      recargarAsig();
    }
  }

  async function onFinalizar(proyectoId: string) {
    const { error } = await finalizar(usuario.id, proyectoId);
    if (error) toast(error, 'error');
    else {
      toast('Asignación finalizada');
      recargarAsig();
    }
  }

  async function onRecordar() {
    setEnviandoRecordatorio(true);
    const { error, procesados, omitidos } = await enviarRecordatorioEmpleado(usuario.id);
    setEnviandoRecordatorio(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(procesados === 0 ? (omitidos > 0 ? 'Ya recibió un recordatorio hoy' : 'Sin faltantes que recordar') : `Recordatorio enviado a ${usuario.nombre}`);
  }

  function toggleEditando() {
    setEditando((v) => {
      const abriendo = !v;
      if (abriendo) {
        setDraft({
          empresaId: usuario.empresaId,
          departamentoId: usuario.departamentoId ?? '',
          categoriaId: usuario.categoriaId ?? '',
          rol: usuario.rol as RolUsuario,
        });
      }
      return abriendo;
    });
  }

  async function onGuardarEdicion() {
    const cambiaEmpresa = draft.empresaId !== usuario.empresaId;
    const cambiaRol = draft.rol !== usuario.rol;
    if (cambiaEmpresa || cambiaRol) {
      const partes = [cambiaEmpresa && 'la empresa (afecta a sus horas requeridas por calendario y al ámbito intragrupo)', cambiaRol && 'el rol'].filter(Boolean);
      if (!confirmar(`Vas a cambiar ${partes.join(' y ')} de ${usuario.nombre}. ¿Confirmas?`)) return;
    }
    const { error } = await onActualizar(usuario.id, {
      empresaId: draft.empresaId,
      departamentoId: draft.departamentoId || null,
      categoriaId: draft.categoriaId || null,
      rol: draft.rol,
    });
    if (error) toast(error, 'error');
    else {
      toast('Datos actualizados');
      setEditando(false);
    }
  }

  async function handleDesactivar() {
    if (!confirmar(`¿Desactivar a ${usuario.nombre}? Dejará de contar en pendientes/recordatorios. Su acceso NO se bloquea hoy: puede seguir iniciando sesión.`)) return;
    const { error } = await onDesactivar(usuario.id);
    if (error) toast(error, 'error');
    else toast(`${usuario.nombre} desactivado`);
  }

  const iniciales = usuario.nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div>
      <button type="button" className="btn btn-sm" onClick={onVolver}>
        ‹ Volver a usuarios
      </button>

      <div className="my-4 flex flex-wrap items-center gap-3.5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-extrabold text-on-accent">{iniciales}</span>
        <div>
          <h2 className="text-xl font-extrabold">{usuario.nombre}</h2>
          <p className="micro mt-0.5">
            {usuario.empresaNombre} · {usuario.departamento ?? '—'} · {usuario.categoriaNombre ?? '—'} ·{' '}
            <span className={`role inline-block rounded-full px-2 py-0.5 ${usuario.rol.includes('admin') ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-secondary'}`}>
              {ETIQUETA_ROL[usuario.rol]}
            </span>{' '}
            · {usuario.activo ? 'Activo' : 'Inactivo'}
          </p>
        </div>
      </div>

      {!puedeEditar && (
        <p className="mb-3.5 text-xs font-semibold text-ink-tertiary">Empleado de otra empresa del grupo — ves su actividad en tus proyectos, pero no puedes editar sus datos.</p>
      )}

      {loadingBalance ? (
        <p className="mb-4 text-sm text-ink-tertiary">Cargando…</p>
      ) : !balance ? (
        <div className="card mb-4">
          <div className="card-body">
            <p className="text-sm text-ink-tertiary">Fuera de tu empresa — solo ves su actividad en tus proyectos.</p>
          </div>
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2">
          <div className="card p-4">
            <p className="mono text-2xl font-extrabold">
              {fmt(balance.horasImputadas)} <small className="text-xs text-ink-tertiary">/ {fmt(balance.requeridasEfectivas)} h</small>
            </p>
            <p className="micro mt-1">Imputadas · {nombreMes.toLowerCase()}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-tertiary">requeridas efectivas (netas de ausencias)</p>
          </div>
          <div className="card p-4">
            <p className="mono text-2xl font-extrabold">
              {balance.balance > 0 ? '+' : ''}
              {fmt(balance.balance)} <small className="text-xs text-ink-tertiary">h</small>
            </p>
            <p className="micro mt-1">Balance del mes</p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-tertiary">{balance.balance >= 0 ? 'al día' : 'por debajo de lo requerido'}</p>
          </div>
          <div className="card p-4">
            <p className="mono text-2xl font-extrabold">{diasAusenciaMes}</p>
            <p className="micro mt-1">Días de ausencia</p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-tertiary">{diasAusenciaMes ? 'aprobadas este mes' : 'ninguna este mes'}</p>
          </div>
          <div className="card p-4">
            <p className="mono text-2xl font-extrabold">{pendientesUsuario.length}</p>
            <p className="micro mt-1">Pendientes de aprobar</p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-tertiary">{pendientesUsuario.length ? 'requieren tu revisión' : 'nada pendiente'}</p>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Reparto del mes por proyecto</h2>
            <span className="micro">{nombreMes}</span>
          </div>
          <div className="card-body">
            {loadingFicha ? (
              <p className="text-sm text-ink-tertiary">Cargando…</p>
            ) : porProyecto.length === 0 ? (
              <p className="text-sm text-ink-tertiary">Sin horas imputadas este mes.</p>
            ) : (
              <div className="space-y-2">
                {porProyecto.map((p) => {
                  const max = Math.max(...porProyecto.map((x) => x.horas), 1);
                  return (
                    <div key={p.proyectoId} className="flex items-center gap-2 text-sm">
                      <span className="w-28 shrink-0 truncate">{p.proyectoNombre}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                        <span className="block h-full rounded-full bg-ink-primary" style={{ width: `${Math.round((p.horas / max) * 100)}%` }} />
                      </span>
                      <span className="mono w-14 shrink-0 text-right">{fmt(p.horas)} h</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Proyectos asignados</h2>
          </div>
          <div className="card-body">
            {loadingAsig ? (
              <p className="text-sm text-ink-tertiary">Cargando…</p>
            ) : asignacionesVigentes.length === 0 ? (
              <p className="text-sm text-ink-tertiary">Sin proyectos asignados todavía — asígnale el primero aquí abajo.</p>
            ) : (
              asignacionesVigentes.map((a) => (
                <div key={a.proyectoId} className="flex items-center gap-2 border-b border-border py-1.5 text-[13px] last:border-b-0">
                  <b className="font-extrabold">{a.proyectoNombre}</b>
                  <span className="micro">· {a.empresaNombre} · desde {a.desde}</span>
                  <button type="button" className="btn btn-sm ml-auto" onClick={() => onFinalizar(a.proyectoId)}>
                    Finalizar
                  </button>
                </div>
              ))
            )}
            <div className="mt-3 flex items-center gap-2">
              <select className="input flex-1" value={proyectoNuevo} onChange={(e) => setProyectoNuevo(e.target.value)}>
                <option value="">Selecciona proyecto</option>
                {proyectosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.empresaNombre}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={onAsignar}>
                ＋ Asignar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Pendientes de aprobar</h2>
          <span className="micro">De este usuario</span>
        </div>
        <div className="px-1.5 pb-2">
          <TablaPendientesImputacion
            pendientes={pendientesUsuario}
            loading={loadingPendientesTodos}
            onAprobar={aprobar}
            onRechazar={rechazar}
            mostrarEmpleado={false}
            mensajeVacio="Nada pendiente de aprobar de este usuario."
          />
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Ausencias</h2>
          <span className="micro">Este mes</span>
        </div>
        <div className="card-body">
          {loadingAusenciasTodas ? (
            <p className="text-sm text-ink-tertiary">Cargando…</p>
          ) : ausenciasUsuario.length === 0 ? (
            <p className="text-sm text-ink-tertiary">Sin ausencias este mes.</p>
          ) : (
            ausenciasUsuario.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border-b border-border py-1.5 text-[13px] last:border-b-0">
                <b className="font-extrabold">{ETIQUETA_TIPO_AUSENCIA[a.tipo] ?? a.tipo}</b>
                <span className="micro">
                  · {a.fechaInicio} — {a.fechaFin}
                </span>
                {a.estado === 'pendiente' && puedeEditar ? (
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      className="btn-text"
                      onClick={async () => {
                        const { error } = await rechazarAusencia(a.id, 'Rechazada desde la ficha de usuario');
                        if (error) toast(error, 'error');
                        else toast('Ausencia rechazada');
                      }}
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={async () => {
                        const { error } = await aprobarAusencia(a.id);
                        if (error) toast(error, 'error');
                        else toast('Ausencia aprobada');
                      }}
                    >
                      Aprobar
                    </button>
                  </span>
                ) : a.estado === 'pendiente' ? (
                  <span className="state ml-auto text-xs text-ink-tertiary">Pendiente</span>
                ) : (
                  <span className="state ml-auto text-xs text-ink-tertiary">{a.estado === 'aprobada' ? 'Aprobada' : a.estado === 'rechazada' ? 'Rechazada' : a.estado}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Últimas imputaciones</h2>
          <span className="micro">Ver horas del usuario</span>
        </div>
        <div className="px-1.5 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                <th className="border-b border-border px-2.5 py-2">Fecha</th>
                <th className="border-b border-border px-2.5 py-2">Línea</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Horas</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loadingFicha ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-3 text-sm text-ink-tertiary">
                    Cargando…
                  </td>
                </tr>
              ) : ultimas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-3">
                    <p className="text-sm text-ink-tertiary">Todavía no ha imputado ninguna línea.</p>
                  </td>
                </tr>
              ) : (
                ultimas.map((l) => (
                  <tr key={l.id} className="hover:bg-subtle">
                    <td className="mono border-b border-border px-2.5 py-2.5">{l.fecha}</td>
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{l.proyectoNombre}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(l.horas)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right text-xs text-ink-tertiary">{l.estado}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">Historial completo en la app del empleado o vía imputación directa.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Acciones sobre el usuario</h2>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" disabled={enviandoRecordatorio} onClick={onRecordar}>
              {enviandoRecordatorio ? 'Enviando…' : 'Recordar por email'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onIrAControl(usuario.id)}>
              Imputación directa ›
            </button>
            {puedeEditar && (
              <>
                <button type="button" className="btn btn-sm" onClick={toggleEditando}>
                  Editar datos
                </button>
                <button type="button" className="btn btn-sm text-ink-tertiary" onClick={handleDesactivar}>
                  Desactivar usuario
                </button>
              </>
            )}
          </div>

          {editando && puedeEditar && (
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Empresa empleadora</label>
                  <select className="input" disabled={!esAdminGrupo} value={draft.empresaId} onChange={(e) => setDraft((d) => ({ ...d, empresaId: e.target.value }))}>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Departamento</label>
                  <select className="input" value={draft.departamentoId} onChange={(e) => setDraft((d) => ({ ...d, departamentoId: e.target.value }))}>
                    <option value="">Sin departamento</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Categoría</label>
                  <select className="input" value={draft.categoriaId} onChange={(e) => setDraft((d) => ({ ...d, categoriaId: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Rol</label>
                  <select className="input" disabled={!esAdminGrupo} value={draft.rol} onChange={(e) => setDraft((d) => ({ ...d, rol: e.target.value as RolUsuario }))}>
                    <option value="empleado">Empleado</option>
                    <option value="responsable_proyecto">Responsable de proyecto</option>
                    {esAdminGrupo && <option value="admin_empresa">Admin de empresa</option>}
                    {esAdminGrupo && <option value="admin_grupo">Admin del grupo</option>}
                  </select>
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={onGuardarEdicion}>
                Guardar cambios
              </button>
            </div>
          )}

          {!puedeEditar && (
            <p className="mt-3 text-xs text-ink-tertiary">Cambiar empresa/rol/departamento y desactivar solo lo puede hacer un admin de su propia empresa (o admin del grupo).</p>
          )}
        </div>
      </div>
    </div>
  );
}
