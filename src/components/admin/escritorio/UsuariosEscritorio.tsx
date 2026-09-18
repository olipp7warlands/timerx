'use client';

import { useEffect, useState } from 'react';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useDepartamentos } from '@/hooks/admin/useDepartamentos';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useToast } from '@/components/empleado/compartido/Toast';
import { invitarUsuario } from '@/app/admin/actions';
import { ETIQUETA_ROL } from '@/lib/auth/roles';
import { generarPasswordTemporal } from '@/lib/usuarios/password';
import { FichaUsuarioEscritorio } from './FichaUsuarioEscritorio';
import { ImportadorBloque } from '../compartido/ImportadorBloque';
import { useNavAdmin } from '../NavAdmin';
import type { AdminInfo } from '../types';

export function UsuariosEscritorio({ info }: { info: AdminInfo }) {
  const nav = useNavAdmin();
  const { usuarios, loading, recargar, actualizar, desactivar } = useUsuarios();
  const { departamentos, crear: crearDepartamento } = useDepartamentos();
  const { empresas } = useEmpresas();
  const { categorias } = useCategorias();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [busqueda, setBusqueda] = useState('');
  // Hand-off efímero `?invitar=<empresaId>` (desde la ficha de empresa): la sección se monta al llegar, así que
  // basta con leerlo como valor inicial; después se limpia de la URL para que atrás/adelante no lo re-apliquen.
  const invitarEmpresaId = nav.consulta.get('invitar');
  const [form, setForm] = useState({ email: '', nombre: '', empresaId: invitarEmpresaId ?? info.empresaId, departamentoId: '', rol: 'empleado', categoriaId: '', password: '' });
  /** Alta recién hecha con contraseña inicial: se muestra UNA vez para que el admin la copie y la entregue en mano. */
  const [altaCreada, setAltaCreada] = useState<{ email: string; password: string } | null>(null);
  const { limpiarConsulta } = nav;
  useEffect(() => {
    if (invitarEmpresaId) limpiarConsulta();
  }, [invitarEmpresaId, limpiarConsulta]);

  const [enviando, setEnviando] = useState(false);
  const [depNombre, setDepNombre] = useState('');

  // Ficha derivada de la URL. Con datos aún cargando se ESPERA (nunca se redirige al listado);
  // solo si tras cargar el id no existe (o la RLS no lo muestra) se vuelve al listado con aviso.
  const seleccionado = nav.fichaId ? usuarios.find((u) => u.id === nav.fichaId) ?? null : null;
  const fichaInexistente = !!nav.fichaId && !loading && !seleccionado;
  useEffect(() => {
    if (!fichaInexistente) return;
    toast('Ese usuario no existe o no está en tu ámbito', 'error');
    nav.ir('usuarios', { reemplazar: true });
  }, [fichaInexistente]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = usuarios.filter((u) => u.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  // El azar se genera FUERA del updater de estado: React (StrictMode) puede invocar el updater más de una vez y una función
  // impura dejaría en el campo una contraseña y en el estado otra distinta (bug real hallado en la verificación).
  function generarPassword() {
    const password = generarPasswordTemporal();
    setForm((f) => ({ ...f, password }));
  }

  async function enviarInvitacion() {
    if (!form.email || !form.nombre) {
      toast('Email y nombre son obligatorios', 'error');
      return;
    }
    setEnviando(true);
    const { error, modo } = await invitarUsuario({
      email: form.email,
      nombre: form.nombre,
      empresaId: form.empresaId,
      departamentoId: form.departamentoId || null,
      rol: form.rol as 'empleado' | 'responsable_proyecto' | 'admin_empresa' | 'admin_grupo',
      categoriaId: form.categoriaId || null,
      password: form.password || null,
    });
    setEnviando(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    if (modo === 'con-password') {
      toast(`Cuenta creada para ${form.email}`);
      setAltaCreada({ email: form.email, password: form.password });
    } else {
      toast(modo === 'invitar' ? `Invitación enviada a ${form.email}` : `Cuenta creada para ${form.email} (sin contraseña ni correo): dale acceso con «Restablecer contraseña» en su ficha`);
    }
    setForm({ email: '', nombre: '', empresaId: info.empresaId, departamentoId: '', rol: 'empleado', categoriaId: '', password: '' });
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

  if (nav.fichaId) {
    if (!seleccionado) return <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
    return (
      <FichaUsuarioEscritorio
        info={info}
        usuario={seleccionado}
        onVolver={() => nav.ir('usuarios')}
        onIrAControl={(empleadoId) => nav.ir('control', { query: { empleado: empleadoId } })}
        onActualizar={actualizar}
        onDesactivar={desactivar}
      />
    );
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
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Contraseña inicial</label>
            <div className="flex gap-2">
              <input
                className="input mono flex-1"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Opcional · mín. 8 caracteres"
                autoComplete="off"
              />
              <button type="button" className="btn btn-sm" onClick={generarPassword}>
                Generar
              </button>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-ink-tertiary">Se la entregas en mano. Sin contraseña, la cuenta nace sin acceso hasta «Restablecer contraseña» en su ficha.</p>
            <button type="button" className="btn btn-primary full" disabled={enviando} onClick={enviarInvitacion}>
              {enviando ? 'Creando…' : 'Crear usuario'}
            </button>
            {altaCreada && (
              <div className="mt-3 rounded-xl border border-border bg-subtle p-3 text-xs" data-testid="alta-creada">
                <p className="font-extrabold">Cuenta creada · {altaCreada.email}</p>
                <p className="mt-1">
                  Contraseña inicial: <span className="mono font-extrabold">{altaCreada.password}</span>
                </p>
                <p className="mt-1 text-ink-tertiary">Cópiala ahora y entrégasela en mano: no se vuelve a mostrar.</p>
                <button type="button" className="btn btn-sm mt-2" onClick={() => setAltaCreada(null)}>
                  Entendido
                </button>
              </div>
            )}
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

      <div className="stack space-y-4">
      {esAdminGrupo && (
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Importar / Exportar</h2>
          </div>
          <div className="card-body space-y-5">
            <ImportadorBloque
              tipo="usuarios"
              titulo="Usuarios"
              descripcion="Altas masivas desde Excel. Solo crea usuarios nuevos (un email existente es un error). Todo o nada."
              exportHref="/api/export/usuarios"
              exportEtiqueta="Exportar usuarios"
              onImportado={recargar}
            />
            <hr className="border-border" />
            <ImportadorBloque
              tipo="coste"
              titulo="Coste/hora (dato salarial)"
              descripcion="Coste interno por hora, versionado por fecha (no es la tarifa de refacturación). Solo el admin del grupo lo ve."
              exportHref="/api/export/coste"
              exportEtiqueta="Exportar coste vigente"
            />
          </div>
        </div>
      )}

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
                  <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr
                    key={u.id}
                    className="row-link hover:bg-subtle"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button')) nav.ir('usuarios', { fichaId: u.id });
                    }}
                  >
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{u.nombre}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.empresaNombre}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.departamento ?? '—'}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <span className={`role inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold ${u.rol === 'admin_grupo' ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-secondary'}`}>
                        {ETIQUETA_ROL[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5">{u.categoriaNombre ?? '—'}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right">
                      <button type="button" className="btn btn-sm" onClick={() => nav.ir('usuarios', { fichaId: u.id })}>
                        Ver
                      </button>
                    </td>
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
    </div>
  );
}
