'use client';

import { useState } from 'react';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useDepartamentos } from '@/hooks/admin/useDepartamentos';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useToast } from '@/components/empleado/compartido/Toast';
import { invitarUsuario } from '@/app/admin/actions';
import { ETIQUETA_ROL } from '@/lib/auth/roles';
import type { AdminInfo } from '../types';

export function UsuariosEscritorio({ info }: { info: AdminInfo }) {
  const { usuarios, loading, recargar } = useUsuarios();
  const { departamentos, crear: crearDepartamento } = useDepartamentos();
  const { empresas } = useEmpresas();
  const { categorias } = useCategorias();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState({ email: '', nombre: '', empresaId: info.empresaId, departamentoId: '', rol: 'empleado', categoriaId: '' });
  const [enviando, setEnviando] = useState(false);
  const [depNombre, setDepNombre] = useState('');

  const filtrados = usuarios.filter((u) => u.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  async function enviarInvitacion() {
    if (!form.email || !form.nombre) {
      toast('Email y nombre son obligatorios', 'error');
      return;
    }
    setEnviando(true);
    const { error } = await invitarUsuario({
      email: form.email,
      nombre: form.nombre,
      empresaId: form.empresaId,
      departamentoId: form.departamentoId || null,
      rol: form.rol as 'empleado' | 'responsable_proyecto' | 'admin_empresa' | 'admin_grupo',
      categoriaId: form.categoriaId || null,
    });
    setEnviando(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`Invitación enviada a ${form.email}`);
    setForm({ email: '', nombre: '', empresaId: info.empresaId, departamentoId: '', rol: 'empleado', categoriaId: '' });
    recargar();
  }

  async function crearDep() {
    if (!depNombre) return;
    const { error } = await crearDepartamento(depNombre, null);
    if (error) toast(error, 'error');
    else {
      toast(`Departamento "${depNombre}" creado`);
      setDepNombre('');
    }
  }

  return (
    <div className="split grid grid-cols-[300px_minmax(0,1fr)] items-start gap-4.5 max-[920px]:grid-cols-1">
      <div className="stack space-y-4">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Invitar usuario</h2>
          </div>
          <div className="card-body space-y-1">
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="nombre@wowinx.com" />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre Apellido" />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Empresa empleadora</label>
            <select
              className="input"
              value={form.empresaId}
              disabled={!esAdminGrupo}
              onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Departamento</label>
            <select className="input" value={form.departamentoId} onChange={(e) => setForm((f) => ({ ...f, departamentoId: e.target.value }))}>
              <option value="">Sin departamento</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Rol</label>
            <select className="input" value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
              <option value="empleado">Empleado</option>
              <option value="responsable_proyecto">Responsable</option>
              {esAdminGrupo && <option value="admin_empresa">Admin de empresa</option>}
              {esAdminGrupo && <option value="admin_grupo">Admin de grupo</option>}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Categoría por defecto</label>
            <select className="input" value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary full" disabled={enviando} onClick={enviarInvitacion}>
              {enviando ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Crear departamento</h2>
          </div>
          <div className="card-body">
            <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
            <input className="input" value={depNombre} onChange={(e) => setDepNombre(e.target.value)} placeholder="Tecnología" />
            <button type="button" className="btn full" onClick={crearDep}>
              Crear departamento
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">
            Usuarios <span className="micro font-bold">· {usuarios.length}</span>
          </h2>
          <input className="input w-[190px]" placeholder="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="px-1.5 pb-2">
          {loading ? (
            <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Nombre</th>
                  <th className="border-b border-border px-2.5 py-2">Empresa</th>
                  <th className="border-b border-border px-2.5 py-2">Departamento</th>
                  <th className="border-b border-border px-2.5 py-2">Rol</th>
                  <th className="border-b border-border px-2.5 py-2">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id} className="hover:bg-subtle">
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{u.nombre}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.empresaNombre}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.departamento ?? '—'}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <span className={`role inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold ${u.rol === 'admin_grupo' ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-secondary'}`}>
                        {ETIQUETA_ROL[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.categoriaNombre ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
            El responsable de departamento aprueba ausencias y vigila las imputaciones faltantes de su equipo.
          </p>
        </div>
      </div>
    </div>
  );
}
