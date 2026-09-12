'use client';

import { useState } from 'react';
import type { Empresa } from '@/hooks/admin/useEmpresas';
import type { ProyectoAdmin, NuevoProyecto } from '@/hooks/admin/useProyectosAdmin';
import type { UsuarioAdmin } from '@/hooks/admin/useUsuarios';
import type { LineaRefacturacion } from '@/hooks/admin/useRefacturacion';
import type { HorasProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useToast } from '@/components/empleado/compartido/Toast';
import { confirmar } from '@/components/ui/confirmar';
import { ETIQUETA_ROL } from '@/lib/auth/roles';
import { fmt, formatoMes } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

interface Props {
  info: AdminInfo;
  empresa: Empresa;
  proyectos: ProyectoAdmin[];
  usuarios: UsuarioAdmin[];
  refacturacion: LineaRefacturacion[];
  porProyecto: HorasProyecto[];
  horasEmpresa: number;
  mes: number;
  onVolver: () => void;
  onActualizar: (id: string, input: { nombre: string; cif: string | null }) => Promise<{ error: string | null }>;
  onDesactivar: (id: string) => Promise<{ error: string | null }>;
  onCrearProyecto: (input: NuevoProyecto) => Promise<{ error: string | null }>;
  onIrAProyecto: (proyectoId: string) => void;
  onIrAUsuario: (usuarioId: string) => void;
  onIrAInvitarUsuario: (empresaId: string) => void;
  onIrARefacturacion: () => void;
}

export function FichaEmpresaEscritorio({
  info,
  empresa,
  proyectos,
  usuarios,
  refacturacion,
  porProyecto,
  horasEmpresa,
  mes,
  onVolver,
  onActualizar,
  onDesactivar,
  onCrearProyecto,
  onIrAProyecto,
  onIrAUsuario,
  onIrAInvitarUsuario,
  onIrARefacturacion,
}: Props) {
  const toast = useToast();
  const nombreMes = formatoMes(mes);

  const esAdminGrupo = info.rol === 'admin_grupo';
  const puedeEditar = esAdminGrupo;
  const puedeCrearAqui = esAdminGrupo || empresa.id === info.empresaId;

  const proyectosDeEmpresa = proyectos.filter((p) => p.empresaId === empresa.id);
  const empleadosDeEmpresa = usuarios.filter((u) => u.empresaId === empresa.id);
  const proyectosActivos = proyectosDeEmpresa.filter((p) => p.activo);
  const refacturacionDeEmpresa = refacturacion.filter((l) => l.empresaDestinoId === empresa.id);

  const porOrigen = new Map<string, number>();
  for (const l of refacturacionDeEmpresa) {
    porOrigen.set(l.empresaOrigen, (porOrigen.get(l.empresaOrigen) ?? 0) + l.importe);
  }
  const totalRefacturacion = [...porOrigen.values()].reduce((s, v) => s + v, 0);

  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState({ nombre: empresa.nombre, cif: empresa.cif ?? '' });
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');

  function toggleEditando() {
    setEditando((v) => {
      const abriendo = !v;
      if (abriendo) setDraft({ nombre: empresa.nombre, cif: empresa.cif ?? '' });
      return abriendo;
    });
  }

  async function onGuardarEdicion() {
    const { error } = await onActualizar(empresa.id, { nombre: draft.nombre, cif: draft.cif || null });
    if (error) toast(error, 'error');
    else {
      toast('Datos actualizados');
      setEditando(false);
    }
  }

  async function handleDesactivar() {
    if (proyectosActivos.length > 0) {
      toast(`No se puede desactivar: tiene ${proyectosActivos.length} proyecto${proyectosActivos.length === 1 ? '' : 's'} activo${proyectosActivos.length === 1 ? '' : 's'}.`, 'error');
      return;
    }
    const empleadosActivos = empleadosDeEmpresa.filter((u) => u.activo);
    if (empleadosActivos.length > 0) {
      toast(`No se puede desactivar: tiene ${empleadosActivos.length} empleado${empleadosActivos.length === 1 ? '' : 's'} activo${empleadosActivos.length === 1 ? '' : 's'}.`, 'error');
      return;
    }
    if (!confirmar(`¿Desactivar ${empresa.nombre}? No tiene proyectos activos ni empleados activos.`)) return;
    const { error } = await onDesactivar(empresa.id);
    if (error) toast(error, 'error');
    else toast(`${empresa.nombre} desactivada`);
  }

  async function onNuevoProyecto() {
    if (!nuevoNombre.trim() || !nuevoCodigo.trim()) {
      toast('Nombre y código son obligatorios', 'error');
      return;
    }
    const { error } = await onCrearProyecto({ empresaId: empresa.id, codigo: nuevoCodigo.trim(), nombre: nuevoNombre.trim() });
    if (error) toast(error, 'error');
    else {
      toast(`Proyecto "${nuevoNombre.trim()}" creado`);
      setNuevoNombre('');
      setNuevoCodigo('');
    }
  }

  const iniciales = empresa.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <button type="button" className="btn btn-sm" onClick={onVolver}>
        ‹ Volver a empresas
      </button>

      <div className="my-4 flex flex-wrap items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-sm font-extrabold text-on-accent">{iniciales}</span>
        <div>
          <h2 className="text-xl font-extrabold">
            {empresa.nombre} <small className="mono ml-1.5 text-xs font-normal text-ink-tertiary">{empresa.cif ?? '—'}</small>
          </h2>
          <p className="micro mt-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-[7px] w-[7px] rounded-full ${empresa.activa ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
              {empresa.activa ? 'Activa' : 'Inactiva'}
            </span>{' '}
            · empresa receptora de servicio
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2">
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">{empleadosDeEmpresa.length}</p>
          <p className="micro mt-1">Empleados</p>
        </div>
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">
            {proyectosActivos.length} <small className="text-xs text-ink-tertiary">de {proyectosDeEmpresa.length}</small>
          </p>
          <p className="micro mt-1">Proyectos activos</p>
        </div>
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">
            {fmt(horasEmpresa)} <small className="text-xs text-ink-tertiary">h</small>
          </p>
          <p className="micro mt-1">Horas recibidas · {nombreMes.toLowerCase()}</p>
        </div>
        <div className="card p-4">
          <p className="mono text-2xl font-extrabold">{totalRefacturacion.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
          <p className="micro mt-1">Refacturación · {nombreMes.toLowerCase()}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Proyectos de la empresa</h2>
          </div>
          <div className="px-1.5 pb-2">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Proyecto</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Horas · mes</th>
                  <th className="border-b border-border px-2.5 py-2">Estado</th>
                  <th className="border-b border-border px-2.5 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {proyectosDeEmpresa.map((p) => {
                  const horas = porProyecto.find((h) => h.proyectoId === p.id)?.horas ?? 0;
                  return (
                    <tr
                      key={p.id}
                      className="row-link hover:bg-subtle"
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest('button')) onIrAProyecto(p.id);
                      }}
                    >
                      <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{p.nombre}</td>
                      <td className={`mono border-b border-border px-2.5 py-2.5 text-right ${horas === 0 ? 'text-ink-tertiary' : ''}`}>{fmt(horas)}</td>
                      <td className="border-b border-border px-2.5 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
                          <span className={`h-[7px] w-[7px] rounded-full ${p.activo ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
                          {p.activo ? 'Activo' : 'Sin actividad'}
                        </span>
                      </td>
                      <td className="border-b border-border px-2.5 py-2.5 text-right">
                        <button type="button" className="btn btn-sm" onClick={() => onIrAProyecto(p.id)}>
                          Ver ›
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {puedeCrearAqui && (
              <div className="flex items-center gap-2 p-3">
                <input className="input" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} placeholder="Código" style={{ maxWidth: 100 }} />
                <input className="input flex-1" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre del nuevo proyecto" style={{ maxWidth: 260 }} />
                <button type="button" className="btn btn-primary btn-sm" onClick={onNuevoProyecto}>
                  ＋ Nuevo proyecto
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Empleados</h2>
            {puedeCrearAqui && (
              <button type="button" className="btn btn-sm" onClick={() => onIrAInvitarUsuario(empresa.id)}>
                ＋ Invitar usuario ›
              </button>
            )}
          </div>
          <div className="px-1.5 pb-2">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Nombre</th>
                  <th className="border-b border-border px-2.5 py-2">Departamento</th>
                  <th className="border-b border-border px-2.5 py-2">Categoría</th>
                  <th className="border-b border-border px-2.5 py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {empleadosDeEmpresa.map((u) => (
                  <tr
                    key={u.id}
                    className="row-link hover:bg-subtle"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button')) onIrAUsuario(u.id);
                    }}
                  >
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{u.nombre}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.departamento ?? '—'}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.categoriaNombre ?? '—'}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <span className={`role inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold ${u.rol === 'admin_grupo' ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-secondary'}`}>
                        {ETIQUETA_ROL[u.rol] ?? u.rol}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">Cambiar a alguien de empresa se hace desde su ficha de usuario (Editar datos).</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Refacturación del mes</h2>
            <button type="button" className="btn btn-sm" onClick={onIrARefacturacion}>
              Detalle ›
            </button>
          </div>
          <div className="card-body">
            {[...porOrigen.entries()].map(([origen, importe]) => (
              <div key={origen} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-b-0">
                <span>{origen}</span>
                <span className="mono">{importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 text-sm font-extrabold">
              <span>Total recibido</span>
              <span className="mono">{totalRefacturacion.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Acciones sobre la empresa</h2>
          </div>
          <div className="card-body">
            {puedeEditar ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm" onClick={toggleEditando}>
                    Editar datos
                  </button>
                  <button type="button" className="btn btn-sm text-ink-tertiary" onClick={handleDesactivar}>
                    Desactivar empresa
                  </button>
                </div>
                {editando && (
                  <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
                    <div>
                      <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
                      <input className="input" value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">CIF</label>
                      <input className="input mono" value={draft.cif} onChange={(e) => setDraft((d) => ({ ...d, cif: e.target.value }))} />
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" style={{ gridColumn: '1 / -1' }} onClick={onGuardarEdicion}>
                      Guardar cambios
                    </button>
                  </div>
                )}
                <p className="foot mt-2.5 text-xs text-ink-tertiary">Desactivar exige no tener proyectos activos ni empleados activos.</p>
              </>
            ) : (
              <p className="text-sm text-ink-tertiary">Editar y desactivar empresas es solo para admin de grupo.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
