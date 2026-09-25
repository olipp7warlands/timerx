'use client';

import { useEffect, useState } from 'react';
import { useUsuarios, type ActualizarUsuarioInput, type UsuarioAdmin } from '@/hooks/admin/useUsuarios';
import { useDepartamentos } from '@/hooks/admin/useDepartamentos';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useCategorias } from '@/hooks/admin/useCategorias';
import { useToast } from '@/components/empleado/compartido/Toast';
import { invitarUsuario } from '@/app/admin/actions';
import { confirmar } from '@/components/ui/confirmar';
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/auth/roles';
import { generarPasswordTemporal } from '@/lib/usuarios/password';
import { esUnicoAdminGrupo, puedeAdministrarPerfil } from '@/lib/usuarios/permisos';
import { FichaUsuarioEscritorio } from './FichaUsuarioEscritorio';
import { ImportadorBloque } from '../compartido/ImportadorBloque';
import { CeldaEditable } from '../compartido/CeldaEditable';
import { Pestanas, propsPanelPestana } from '../compartido/Pestanas';
import { useNavAdmin } from '../NavAdmin';
import type { AdminInfo } from '../types';

/** Vistas de la sección: la activa vive en la URL (`?vista=importar` / `?vista=costes`; sin parámetro = usuarios), como `?dia=` del calendario. */
type Vista = 'usuarios' | 'importar' | 'costes';
const PESTANAS: { id: Vista; etiqueta: string }[] = [
  { id: 'usuarios', etiqueta: 'Usuarios' },
  { id: 'importar', etiqueta: 'Importar' },
  { id: 'costes', etiqueta: 'Costes' },
];

export function UsuariosEscritorio({ info }: { info: AdminInfo }) {
  const nav = useNavAdmin();
  const { usuarios, loading, recargar, actualizar, desactivar, reactivar } = useUsuarios();
  const { departamentos, crear: crearDepartamento } = useDepartamentos();
  const { empresas } = useEmpresas();
  const { categorias, crearCategoria } = useCategorias();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [busqueda, setBusqueda] = useState('');
  // Hand-off efímero `?invitar=<empresaId>` (desde la ficha de empresa): la sección se monta al llegar, así que
  // basta con leerlo como valor inicial; después se limpia de la URL para que atrás/adelante no lo re-apliquen.
  // Además abre el formulario (colapsado por defecto) y fuerza la pestaña «Usuarios», que es donde vive.
  const invitarEmpresaId = nav.consulta.get('invitar');
  const [formAbierto, setFormAbierto] = useState(!!invitarEmpresaId);
  const [form, setForm] = useState({ email: '', nombre: '', empresaId: invitarEmpresaId ?? info.empresaId, departamentoId: '', rol: 'empleado', categoriaId: '', password: '' });
  /** Alta recién hecha con contraseña inicial: se muestra UNA vez para que el admin la copie y la entregue en mano. */
  const [altaCreada, setAltaCreada] = useState<{ email: string; password: string } | null>(null);
  const { limpiarConsulta } = nav;
  useEffect(() => {
    if (invitarEmpresaId) limpiarConsulta();
  }, [invitarEmpresaId, limpiarConsulta]);

  // Importar y Costes son solo admin_grupo (el servidor lo impone igualmente): admin_empresa ve la sección sin pestañas.
  const vistaParam = nav.consulta.get('vista');
  const vista: Vista = esAdminGrupo && !invitarEmpresaId && (vistaParam === 'importar' || vistaParam === 'costes') ? vistaParam : 'usuarios';
  function cambiarVista(v: Vista) {
    nav.ir('usuarios', { query: v === 'usuarios' ? undefined : { vista: v }, conservarScroll: true });
  }

  const [enviando, setEnviando] = useState(false);
  const [depNombre, setDepNombre] = useState('');

  // Alta rápida de categoría (Lote 4): nace GLOBAL (departamento NULL); para acotarla, sección Categorías.
  const [catRapida, setCatRapida] = useState<{ abierta: boolean; nombre: string; creada: boolean }>({ abierta: false, nombre: '', creada: false });

  // Edición inline (Lote 4): una sola celda abierta a la vez + ✓ efímero de la última guardada.
  type CampoInline = 'departamento' | 'rol' | 'categoria';
  const [celda, setCelda] = useState<{ id: string; campo: CampoInline } | null>(null);
  const [celdaGuardada, setCeldaGuardada] = useState<{ id: string; campo: CampoInline } | null>(null);

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

  async function crearCatRapida() {
    const nombre = catRapida.nombre.trim();
    if (!nombre) return;
    const { error, id } = await crearCategoria(nombre);
    if (error || !id) {
      toast(error ?? 'No se pudo crear la categoría', 'error');
      return;
    }
    setForm((f) => ({ ...f, categoriaId: id }));
    setCatRapida({ abierta: false, nombre: '', creada: true });
    setTimeout(() => setCatRapida((c) => ({ ...c, creada: false })), 1400);
  }

  /**
   * Guarda una celda editada in situ con la MISMA mutación que la ficha (`useUsuarios.actualizar`, no una segunda vía).
   * Rol pide la misma confirmación que la ficha; departamento y categoría guardan directo. Empresa y nombre no son
   * editables aquí (la empresa tiene puerta única: la ficha).
   */
  async function guardarCelda(u: UsuarioAdmin, campo: CampoInline, valor: string) {
    setCelda(null);
    // Solo el campo cambiado: nunca reescribir el resto de la fila con datos cacheados (ver ActualizarUsuarioInput).
    const input: ActualizarUsuarioInput = {};
    if (campo === 'departamento') {
      if ((valor || null) === u.departamentoId) return;
      input.departamentoId = valor || null;
    } else if (campo === 'categoria') {
      if ((valor || null) === u.categoriaId) return;
      input.categoriaId = valor || null;
    } else {
      if (valor === u.rol) return;
      if (!confirmar(`Vas a cambiar el rol de ${u.nombre} de «${ETIQUETA_ROL[u.rol]}» a «${ETIQUETA_ROL[valor as RolUsuario]}»: cambia lo que puede ver y aprobar. ¿Confirmas?`)) return;
      input.rol = valor as RolUsuario;
    }
    const { error } = await actualizar(u.id, input);
    if (error) {
      toast(error, 'error');
      return;
    }
    setCeldaGuardada({ id: u.id, campo });
    setTimeout(() => setCeldaGuardada(null), 1200);
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
        unicoAdminGrupo={esAdminGrupo && esUnicoAdminGrupo(usuarios, seleccionado.id)}
        onVolver={() => nav.ir('usuarios')}
        onIrAControl={(empleadoId) => nav.ir('control', { query: { empleado: empleadoId } })}
        onActualizar={actualizar}
        onDesactivar={desactivar}
        onReactivar={reactivar}
      />
    );
  }

  const etiquetaCampo = 'mb-1 block text-xs font-extrabold text-ink-tertiary';

  return (
    <div className="space-y-4">
      {esAdminGrupo && <Pestanas pestanas={PESTANAS} activa={vista} onCambiar={cambiarVista} ariaLabel="Vistas de usuarios" prefijo="usuarios" />}

      {vista === 'usuarios' && (
        <div className="card" {...propsPanelPestana('usuarios', 'usuarios')}>
          <div className="card-head flex-wrap">
            <h2 className="text-sm font-extrabold">
              Usuarios <span className="micro font-bold">· {usuarios.length}</span>
            </h2>
            <input
              className="input min-w-[200px] flex-1"
              aria-label="Buscar usuario"
              placeholder="Buscar por nombre"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button
              type="button"
              className={`btn btn-sm ${formAbierto ? '' : 'btn-primary'}`}
              aria-expanded={formAbierto}
              aria-controls="form-invitar-usuario"
              onClick={() => setFormAbierto((v) => !v)}
              data-testid="invitar-toggle"
            >
              {formAbierto ? 'Cerrar formulario' : '＋ Invitar usuario'}
            </button>
          </div>

          {formAbierto && (
            <div id="form-invitar-usuario" className="card-body border-b border-border" data-testid="form-invitar">
              <h3 className="mb-3 text-[13px] font-extrabold">Invitar usuario</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-4 gap-y-3">
                <div>
                  <label className={etiquetaCampo}>Email</label>
                  <input className="input" autoFocus value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="nombre@wowinx.com" />
                </div>
                <div>
                  <label className={etiquetaCampo}>Nombre</label>
                  <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre Apellido" />
                </div>
                <div>
                  <label className={etiquetaCampo}>Empresa empleadora</label>
                  <select className="input" value={form.empresaId} disabled={!esAdminGrupo} onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}>
                    {empresas
                      .filter((e) => e.activa || e.id === form.empresaId)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={etiquetaCampo}>Departamento</label>
                  <select className="input" value={form.departamentoId} onChange={(e) => setForm((f) => ({ ...f, departamentoId: e.target.value }))}>
                    <option value="">Sin departamento</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiquetaCampo}>Rol</label>
                  <select className="input" value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
                    <option value="empleado">Empleado</option>
                    <option value="responsable_proyecto">Responsable</option>
                    {esAdminGrupo && <option value="admin_empresa">Admin de empresa</option>}
                    {esAdminGrupo && <option value="admin_grupo">Admin de grupo</option>}
                  </select>
                </div>
                <div>
                  <label className={etiquetaCampo}>Categoría por defecto</label>
                  <select className="input" value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {esAdminGrupo && (
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="btn btn-sm" onClick={() => setCatRapida((c) => ({ ...c, abierta: true }))}>
                        {catRapida.creada ? 'Creada ✓' : '＋ Nueva categoría'}
                      </button>
                      {catRapida.abierta && (
                        <>
                          <input
                            className="input flex-1"
                            autoFocus
                            placeholder="Nombre de la categoría"
                            value={catRapida.nombre}
                            onChange={(e) => setCatRapida((c) => ({ ...c, nombre: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') crearCatRapida();
                            }}
                          />
                          <button type="button" className="btn btn-primary btn-sm" onClick={crearCatRapida}>
                            Crear
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={etiquetaCampo}>Contraseña inicial</label>
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
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary" disabled={enviando} onClick={enviarInvitacion}>
                  {enviando ? 'Creando…' : 'Crear usuario'}
                </button>
                {/* Departamento es un catálogo GLOBAL (sin empresa_id): su escritura es solo admin_grupo (024, RLS `departamento_admin`). */}
                {esAdminGrupo && (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-ink-tertiary">¿Falta un departamento?</span>
                    <input className="input w-[180px]" aria-label="Nombre del departamento" value={depNombre} onChange={(e) => setDepNombre(e.target.value)} placeholder="Tecnología" />
                    <button type="button" className="btn btn-sm" onClick={crearDep}>
                      Crear departamento
                    </button>
                  </div>
                )}
              </div>
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
          )}

          <div className="px-1.5 pb-2">
            {loading && usuarios.length === 0 ? (
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
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2.5 py-4 text-sm text-ink-tertiary">
                        {busqueda ? `Ningún usuario coincide con «${busqueda}».` : 'Aún no hay usuarios.'}
                        {!formAbierto && (
                          <>
                            {' '}
                            <button type="button" className="btn-text" onClick={() => setFormAbierto(true)}>
                              Invita al primero
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {filtrados.map((u) => {
                    // Mismas reglas que la ficha (`puedeAdministrarPerfil`, 022): admin_grupo edita a todos; admin_empresa, a los no-admin de su empresa y a sí mismo (si no, celda normal).
                    const puedeEditar = puedeAdministrarPerfil(info, { id: u.id, rol: u.rol as RolUsuario, empresaId: u.empresaId });
                    const abierta = (campo: CampoInline) => celda?.id === u.id && celda.campo === campo;
                    const guardada = (campo: CampoInline) => celdaGuardada?.id === u.id && celdaGuardada.campo === campo;
                    return (
                      <tr
                        key={u.id}
                        className="row-link hover:bg-subtle"
                        onClick={(e) => {
                          const destino = e.target as HTMLElement;
                          if (!destino.closest('button') && !destino.closest('.cell-edit')) nav.ir('usuarios', { fichaId: u.id });
                        }}
                      >
                        <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{u.nombre}</td>
                        <td className="border-b border-border px-2.5 py-2.5">{u.empresaNombre}</td>
                        <CeldaEditable
                          editable={puedeEditar}
                          valor={u.departamentoId ?? ''}
                          opciones={[{ valor: '', etiqueta: 'Sin departamento' }, ...departamentos.map((d) => ({ valor: d.id, etiqueta: d.nombre }))]}
                          abierta={abierta('departamento')}
                          guardada={guardada('departamento')}
                          onAbrir={() => setCelda({ id: u.id, campo: 'departamento' })}
                          onCancelar={() => setCelda(null)}
                          onElegir={(v) => guardarCelda(u, 'departamento', v)}
                        >
                          {u.departamento ?? '—'}
                        </CeldaEditable>
                        <CeldaEditable
                          editable={esAdminGrupo && !esUnicoAdminGrupo(usuarios, u.id)}
                          valor={u.rol}
                          opciones={(['empleado', 'responsable_proyecto', 'admin_empresa', 'admin_grupo'] as RolUsuario[]).map((r) => ({ valor: r, etiqueta: ETIQUETA_ROL[r] }))}
                          abierta={abierta('rol')}
                          guardada={guardada('rol')}
                          onAbrir={() => setCelda({ id: u.id, campo: 'rol' })}
                          onCancelar={() => setCelda(null)}
                          onElegir={(v) => guardarCelda(u, 'rol', v)}
                        >
                          <span className={`role inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold ${u.rol === 'admin_grupo' ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-secondary'}`}>
                            {ETIQUETA_ROL[u.rol] ?? u.rol}
                          </span>
                        </CeldaEditable>
                        <CeldaEditable
                          editable={puedeEditar}
                          valor={u.categoriaId ?? ''}
                          opciones={[{ valor: '', etiqueta: 'Sin categoría' }, ...categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
                          abierta={abierta('categoria')}
                          guardada={guardada('categoria')}
                          onAbrir={() => setCelda({ id: u.id, campo: 'categoria' })}
                          onCancelar={() => setCelda(null)}
                          onElegir={(v) => guardarCelda(u, 'categoria', v)}
                        >
                          {u.categoriaNombre ?? '—'}
                        </CeldaEditable>
                        <td className="border-b border-border px-2.5 py-2.5 text-right">
                          <button type="button" className="btn btn-sm" onClick={() => nav.ir('usuarios', { fichaId: u.id })}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
              El responsable de departamento aprueba ausencias y vigila las imputaciones faltantes de su equipo.
            </p>
          </div>
        </div>
      )}

      {vista === 'importar' && (
        <div className="card" {...propsPanelPestana('usuarios', 'importar')}>
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Importar y exportar usuarios</h2>
          </div>
          <div className="card-body max-w-3xl">
            <ImportadorBloque
              tipo="usuarios"
              titulo="Usuarios"
              descripcion="Altas masivas desde Excel. Solo crea usuarios nuevos (un email existente es un error). Todo o nada."
              exportHref="/api/export/usuarios"
              exportEtiqueta="Exportar usuarios"
              onImportado={recargar}
            />
          </div>
        </div>
      )}

      {vista === 'costes' && (
        <div className="card" {...propsPanelPestana('usuarios', 'costes')}>
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Coste/hora por persona</h2>
          </div>
          <div className="card-body max-w-3xl">
            <p className="mb-4 rounded-xl border border-border bg-subtle p-3 text-xs font-bold text-ink-secondary" data-testid="aviso-salarial">
              Dato salarial: solo lo ve el admin del grupo (no aparece en ninguna otra vista ni para otros roles). Para una sola persona, usa «Registrar coste» en su ficha.
            </p>
            <ImportadorBloque
              tipo="coste"
              titulo="Coste/hora (dato salarial)"
              descripcion="Coste interno por hora, versionado por fecha (no es la tarifa de refacturación): cada importación AÑADE versiones, nunca pisa el histórico."
              exportHref="/api/export/coste"
              exportEtiqueta="Exportar coste vigente"
            />
          </div>
        </div>
      )}
    </div>
  );
}
