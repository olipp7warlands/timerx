'use client';

import { useState } from 'react';
import {
  especialidadesActivas,
  motivoNoDesactivable,
  useDepartamentosAdmin,
  type DepartamentoFila,
  type EmpresaOpcion,
  type Persona,
} from '@/hooks/admin/useDepartamentosAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { confirmar } from '@/components/ui/confirmar';
import { CLAVES_COLOR, ETIQUETA_COLOR, colorDeClave } from '@/lib/horas/colores-departamento';
import { PREDEFINIDOS } from '@/lib/departamentos/predefinidos';
import type { AdminInfo } from '../types';

const etiqueta = 'mb-1 block text-xs font-extrabold text-ink-tertiary';

/** Selector de color: 12 claves de la paleta (el color nunca es el único portador de significado: lleva su nombre). */
function SelectorColor({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color del departamento">
      {CLAVES_COLOR.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={ETIQUETA_COLOR[c]}
          title={ETIQUETA_COLOR[c]}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full border-2 ${value === c ? 'border-ink-primary' : 'border-transparent'}`}
          style={{ background: colorDeClave(c) }}
        />
      ))}
    </div>
  );
}

/** Casillas de empresa («dónde existe el departamento»). */
function SelectorEmpresas({ empresas, value, onChange }: { empresas: EmpresaOpcion[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {empresas.map((e) => (
        <label key={e.id} className="flex items-center gap-1.5 text-sm font-bold">
          <input type="checkbox" checked={value.includes(e.id)} onChange={(ev) => onChange(ev.target.checked ? [...value, e.id] : value.filter((x) => x !== e.id))} />
          {e.nombre}
        </label>
      ))}
    </div>
  );
}

/**
 * /admin/departamentos — v2.0: FUSIONA Departamentos y Especialidades. Solo admin_grupo (la sección ni se ofrece a admin_empresa y la
 * page lo redirige; la RLS de la 024 es la barrera real). Listado (color, responsable, empresas, nº especialidades, nº profesionales)
 * + «＋ Nuevo departamento» desplegable (lista predefinida y/o personalizado) + edición en la propia fila, con las especialidades dentro.
 */
export function DepartamentosEscritorio({ info }: { info: AdminInfo }) {
  const toast = useToast();
  const { departamentos, personas, empresas, loading, crear, actualizar, fijarEmpresas, crearEspecialidad, actualizarEspecialidad } = useDepartamentosAdmin();
  const [formAbierto, setFormAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [personalizado, setPersonalizado] = useState('');
  const [colorNuevo, setColorNuevo] = useState<string | null>(null);
  const [empresasNuevo, setEmpresasNuevo] = useState<string[] | null>(null); // null = todas (por defecto, D4/D9)
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (info.rol !== 'admin_grupo') return <p className="p-4 text-sm text-ink-tertiary">Los departamentos los gestiona el admin del grupo.</p>;

  const existentes = new Set(departamentos.map((d) => d.nombre.toLowerCase()));
  const disponibles = PREDEFINIDOS.filter((p) => !existentes.has(p.nombre.toLowerCase()));
  const empresasDestino = empresasNuevo ?? empresas.map((e) => e.id);

  async function onCrear() {
    const nuevos = [
      ...PREDEFINIDOS.filter((p) => elegidos.includes(p.nombre)).map((p) => ({ nombre: p.nombre, color: p.color as string })),
      ...(personalizado.trim() ? [{ nombre: personalizado.trim(), color: colorNuevo }] : []),
    ];
    if (nuevos.length === 0) {
      toast('Elige al menos un departamento de la lista o escribe uno nuevo', 'error');
      return;
    }
    setGuardando(true);
    const r = await crear(nuevos, empresasDestino);
    setGuardando(false);
    if (r.creados.length > 0) toast(r.creados.length === 1 ? `Departamento "${r.creados[0]}" creado` : `${r.creados.length} departamentos creados`);
    if (r.error) toast(r.error, 'error');
    else if (r.creados.length === 0 && r.saltados.length > 0) toast('Ya existen: ' + r.saltados.join(', '), 'error');
    if (!r.error && r.creados.length > 0) {
      setElegidos([]);
      setPersonalizado('');
      setColorNuevo(null);
      setEmpresasNuevo(null);
      setFormAbierto(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">
            Departamentos <span className="micro font-bold">· {departamentos.length}</span>
          </h2>
          <button
            type="button"
            className={`btn btn-sm ${formAbierto ? '' : 'btn-primary'}`}
            aria-expanded={formAbierto}
            aria-controls="form-nuevo-departamento"
            onClick={() => setFormAbierto((v) => !v)}
            data-testid="nuevo-departamento-toggle"
          >
            {formAbierto ? 'Cerrar formulario' : '＋ Nuevo departamento'}
          </button>
        </div>

        {formAbierto && (
          <div id="form-nuevo-departamento" className="card-body space-y-4 border-b border-border" data-testid="form-nuevo-departamento">
            <h3 className="text-[13px] font-extrabold">Crear departamentos</h3>
            <div>
              <div className="mb-1 flex items-center gap-3">
                <span className={etiqueta + ' mb-0'}>De la lista</span>
                {disponibles.length > 0 && (
                  <button type="button" className="btn-text text-xs" onClick={() => setElegidos(elegidos.length === disponibles.length ? [] : disponibles.map((d) => d.nombre))}>
                    {elegidos.length === disponibles.length ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>
              {disponibles.length === 0 ? (
                <p className="text-xs text-ink-tertiary">Ya existen todos los de la lista.</p>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5" data-testid="lista-predefinidos">
                  {disponibles.map((p) => (
                    <label key={p.nombre} className="flex items-center gap-1.5 text-sm font-bold">
                      <input type="checkbox" checked={elegidos.includes(p.nombre)} onChange={(ev) => setElegidos(ev.target.checked ? [...elegidos, p.nombre] : elegidos.filter((x) => x !== p.nombre))} />
                      <span className="h-2 w-2 rounded-full" style={{ background: colorDeClave(p.color) }} aria-hidden="true" />
                      {p.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-4 gap-y-3">
              <div>
                <label className={etiqueta} htmlFor="departamento-nombre">
                  Nuevo (personalizado)
                </label>
                <input id="departamento-nombre" className="input" value={personalizado} onChange={(e) => setPersonalizado(e.target.value)} placeholder="Atención al cliente" />
              </div>
              {personalizado.trim() && (
                <div>
                  <span className={etiqueta}>Color</span>
                  <SelectorColor value={colorNuevo} onChange={setColorNuevo} />
                </div>
              )}
            </div>
            <div>
              <span className={etiqueta}>Empresas donde existen</span>
              <SelectorEmpresas empresas={empresas} value={empresasDestino} onChange={setEmpresasNuevo} />
            </div>
            <button type="button" className="btn btn-primary" disabled={guardando} onClick={onCrear}>
              {guardando ? 'Creando…' : 'Crear departamentos'}
            </button>
          </div>
        )}

        <div className="px-1.5 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                <th className="border-b border-border px-2.5 py-2">Departamento</th>
                <th className="border-b border-border px-2.5 py-2">Responsable</th>
                <th className="border-b border-border px-2.5 py-2">Empresas</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Especialidades</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Profesionales</th>
                <th className="border-b border-border px-2.5 py-2">Estado</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && departamentos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-4 text-sm text-ink-tertiary" data-testid="departamentos-vacio">
                    Aún no hay departamentos —{' '}
                    {!formAbierto && (
                      <button type="button" className="btn-text" onClick={() => setFormAbierto(true)}>
                        ＋ Nuevo departamento
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {departamentos.map((d) => (
                <FilaDepartamento
                  key={d.id}
                  d={d}
                  abierta={editando === d.id}
                  personas={personas}
                  empresas={empresas}
                  guardando={guardando}
                  setGuardando={setGuardando}
                  onAbrir={() => setEditando(editando === d.id ? null : d.id)}
                  acciones={{ actualizar, fijarEmpresas, crearEspecialidad, actualizarEspecialidad }}
                  toast={toast}
                />
              ))}
            </tbody>
          </table>
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
            Un departamento agrupa a las personas y a las especialidades que se imputan. El responsable aprueba ausencias y vigila las imputaciones faltantes de su equipo. Un departamento con
            especialidades activas o profesionales en activo no se puede desactivar: reubícalos antes.
          </p>
        </div>
      </div>
    </div>
  );
}

type Acciones = Pick<ReturnType<typeof useDepartamentosAdmin>, 'actualizar' | 'fijarEmpresas' | 'crearEspecialidad' | 'actualizarEspecialidad'>;

function FilaDepartamento({
  d,
  abierta,
  personas,
  empresas,
  guardando,
  setGuardando,
  onAbrir,
  acciones,
  toast,
}: {
  d: DepartamentoFila;
  abierta: boolean;
  personas: Persona[];
  empresas: EmpresaOpcion[];
  guardando: boolean;
  setGuardando: (v: boolean) => void;
  onAbrir: () => void;
  acciones: Acciones;
  toast: (m: string, tipo?: 'error') => void;
}) {
  const motivo = motivoNoDesactivable(d);
  const nombresEmpresas = d.empresaIds.length === empresas.length && empresas.length > 0 ? `Todas (${empresas.length})` : empresas.filter((e) => d.empresaIds.includes(e.id)).map((e) => e.nombre).join(', ') || '—';
  return (
    <>
      <tr className={`row-link hover:bg-subtle ${d.activo ? '' : 'opacity-60'}`} onClick={(ev) => !(ev.target as HTMLElement).closest('button') && onAbrir()} data-testid={`departamento-${d.nombre}`}>
        <td className="border-b border-border px-2.5 py-2.5 font-extrabold">
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: colorDeClave(d.color) }} aria-hidden="true" />
          {d.nombre}
          {!d.activo && <span className="mapa-tag ml-2 align-middle">Inactivo</span>}
        </td>
        <td className="border-b border-border px-2.5 py-2.5">{d.responsableNombre ?? '—'}</td>
        <td className="border-b border-border px-2.5 py-2.5 text-xs">{nombresEmpresas}</td>
        <td className="mono border-b border-border px-2.5 py-2.5 text-right">{especialidadesActivas(d)}</td>
        <td className="mono border-b border-border px-2.5 py-2.5 text-right">{d.profesionales}</td>
        <td className="border-b border-border px-2.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
            <span className={`h-[7px] w-[7px] rounded-full ${d.activo ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
            {d.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td className="border-b border-border px-2.5 py-2.5 text-right">
          <button type="button" className="btn btn-sm" aria-expanded={abierta} onClick={onAbrir}>
            {abierta ? 'Cerrar' : 'Abrir'}
          </button>
        </td>
      </tr>
      {abierta && <PanelDepartamento d={d} personas={personas} empresas={empresas} motivo={motivo} guardando={guardando} setGuardando={setGuardando} acciones={acciones} toast={toast} />}
    </>
  );
}

function PanelDepartamento({
  d,
  personas,
  empresas,
  motivo,
  guardando,
  setGuardando,
  acciones,
  toast,
}: {
  d: DepartamentoFila;
  personas: Persona[];
  empresas: EmpresaOpcion[];
  motivo: string | null;
  guardando: boolean;
  setGuardando: (v: boolean) => void;
  acciones: Acciones;
  toast: (m: string, tipo?: 'error') => void;
}) {
  const [draft, setDraft] = useState({ nombre: d.nombre, responsable: d.responsableId ?? '', color: d.color, empresas: d.empresaIds });
  const [nuevaEsp, setNuevaEsp] = useState('');
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);

  async function guardar() {
    const n = draft.nombre.trim();
    if (!n) return toast('El nombre del departamento es obligatorio', 'error');
    const cambios: { nombre?: string; responsableId?: string | null; color?: string | null } = {};
    if (n !== d.nombre) cambios.nombre = n;
    if ((draft.responsable || null) !== d.responsableId) cambios.responsableId = draft.responsable || null;
    if (draft.color !== d.color) cambios.color = draft.color;
    const empresasCambian = draft.empresas.length !== d.empresaIds.length || draft.empresas.some((e) => !d.empresaIds.includes(e));
    if (Object.keys(cambios).length === 0 && !empresasCambian) return toast('No hay cambios que guardar');
    setGuardando(true);
    let error = (await acciones.actualizar(d.id, cambios)).error;
    if (!error && empresasCambian) error = (await acciones.fijarEmpresas(d.id, draft.empresas)).error;
    setGuardando(false);
    toast(error ?? 'Departamento actualizado', error ? 'error' : undefined);
  }

  async function desactivar() {
    if (motivo) return toast(motivo, 'error');
    if (!confirmar(`¿Desactivar el departamento ${d.nombre}? Dejará de ofrecerse al dar de alta o editar profesionales y de aparecer al imputar. Puedes reactivarlo cuando quieras.`)) return;
    setGuardando(true);
    const { error } = await acciones.actualizar(d.id, { activo: false });
    setGuardando(false);
    toast(error ?? `Departamento ${d.nombre} desactivado`, error ? 'error' : undefined);
  }

  async function reactivar() {
    setGuardando(true);
    const { error } = await acciones.actualizar(d.id, { activo: true });
    setGuardando(false);
    toast(error ?? `Departamento ${d.nombre} reactivado`, error ? 'error' : undefined);
  }

  async function anadirEspecialidad() {
    const n = nuevaEsp.trim();
    if (!n) return;
    const { error } = await acciones.crearEspecialidad(d.id, n);
    if (error) return toast(error, 'error');
    toast(`Especialidad "${n}" creada`);
    setNuevaEsp('');
  }

  async function renombrar() {
    if (!renombrando) return;
    const n = renombrando.nombre.trim();
    if (!n) return toast('El nombre de la especialidad es obligatorio', 'error');
    const { error } = await acciones.actualizarEspecialidad(renombrando.id, { nombre: n });
    if (error) return toast(error, 'error');
    toast('Especialidad actualizada');
    setRenombrando(null);
  }

  return (
    <tr>
      <td colSpan={7} className="border-b border-border bg-subtle px-3 py-3" data-testid="edicion-departamento">
        <div className="grid gap-5 lg:grid-cols-2">
          <section aria-label="Datos del departamento" className="space-y-3">
            <h4 className="text-[13px] font-extrabold">Datos del departamento</h4>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-3">
              <div>
                <label className={etiqueta}>Nombre</label>
                <input className="input" aria-label="Nombre del departamento" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
              </div>
              <div>
                <label className={etiqueta}>Responsable</label>
                <select className="input" aria-label="Responsable del departamento" value={draft.responsable} onChange={(e) => setDraft({ ...draft, responsable: e.target.value })}>
                  <option value="">Sin responsable</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className={etiqueta}>Color</span>
              <SelectorColor value={draft.color} onChange={(c) => setDraft({ ...draft, color: c })} />
            </div>
            <div>
              <span className={etiqueta}>Empresas donde existe</span>
              <SelectorEmpresas empresas={empresas} value={draft.empresas} onChange={(v) => setDraft({ ...draft, empresas: v })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {d.activo ? (
                <button type="button" className="btn btn-sm" disabled={guardando} onClick={desactivar} title={motivo ?? undefined}>
                  Desactivar
                </button>
              ) : (
                <button type="button" className="btn btn-sm" disabled={guardando} onClick={reactivar}>
                  Reactivar
                </button>
              )}
              {d.activo && motivo && <span className="text-xs text-ink-tertiary">{motivo}</span>}
            </div>
          </section>

          <section aria-label="Especialidades" className="space-y-2" data-testid="especialidades-departamento">
            <h4 className="text-[13px] font-extrabold">
              Especialidades <span className="micro font-bold">· {especialidadesActivas(d)} activas</span>
            </h4>
            {d.especialidades.length === 0 && <p className="text-xs text-ink-tertiary">Aún no tiene especialidades — añade la primera.</p>}
            <ul className="space-y-1">
              {d.especialidades.map((e) => (
                <li key={e.id} className={`flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-sm ${e.activa ? '' : 'opacity-60'}`}>
                  {renombrando?.id === e.id ? (
                    <>
                      <input
                        className="input flex-1"
                        aria-label="Nombre de la especialidad"
                        autoFocus
                        value={renombrando.nombre}
                        onChange={(ev) => setRenombrando({ id: e.id, nombre: ev.target.value })}
                        onKeyDown={(ev) => ev.key === 'Enter' && renombrar()}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={renombrar}>
                        Guardar
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setRenombrando(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-bold">
                        {e.nombre}
                        {!e.activa && <span className="mapa-tag ml-2 align-middle">Inactiva</span>}
                      </span>
                      <button type="button" className="btn btn-sm" onClick={() => setRenombrando({ id: e.id, nombre: e.nombre })}>
                        Renombrar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={async () => {
                          const { error } = await acciones.actualizarEspecialidad(e.id, { activa: !e.activa });
                          toast(error ?? (e.activa ? `Especialidad ${e.nombre} dada de baja` : `Especialidad ${e.nombre} reactivada`), error ? 'error' : undefined);
                        }}
                      >
                        {e.activa ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 pt-1">
              <input
                className="input flex-1"
                aria-label="Nueva especialidad"
                placeholder="Nueva especialidad (p. ej. Backend)"
                value={nuevaEsp}
                onChange={(e) => setNuevaEsp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && anadirEspecialidad()}
              />
              <button type="button" className="btn btn-sm" onClick={anadirEspecialidad}>
                ＋ Añadir
              </button>
            </div>
          </section>
        </div>
      </td>
    </tr>
  );
}
