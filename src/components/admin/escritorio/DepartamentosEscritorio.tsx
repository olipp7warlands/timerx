'use client';

import { useState } from 'react';
import { useDepartamentosAdmin, motivoNoDesactivable, type DepartamentoFila } from '@/hooks/admin/useDepartamentosAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { confirmar } from '@/components/ui/confirmar';
import type { AdminInfo } from '../types';

const etiqueta = 'mb-1 block text-xs font-extrabold text-ink-tertiary';

/**
 * /admin/departamentos — solo admin_grupo (la sección ni se ofrece a admin_empresa y la page lo redirige; la RLS de la 024 es la
 * barrera real). Listado + «＋ Nuevo departamento» desplegable (patrón de Empresas) + edición en la propia fila.
 */
export function DepartamentosEscritorio({ info }: { info: AdminInfo }) {
  const toast = useToast();
  const { departamentos, personas, loading, crear, actualizar } = useDepartamentosAdmin();
  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [responsable, setResponsable] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [draft, setDraft] = useState({ nombre: '', responsable: '' });
  const [guardando, setGuardando] = useState(false);

  if (info.rol !== 'admin_grupo') return <p className="p-4 text-sm text-ink-tertiary">Los departamentos los gestiona el admin del grupo.</p>;

  async function onCrear() {
    const n = nombre.trim();
    if (!n) {
      toast('El nombre del departamento es obligatorio', 'error');
      return;
    }
    setGuardando(true);
    const { error } = await crear(n, responsable || null);
    setGuardando(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`Departamento "${n}" creado`);
    setNombre('');
    setResponsable('');
    setFormAbierto(false);
  }

  function abrirEdicion(d: DepartamentoFila) {
    if (editando === d.id) {
      setEditando(null);
      return;
    }
    setEditando(d.id);
    setDraft({ nombre: d.nombre, responsable: d.responsableId ?? '' });
  }

  async function onGuardar(d: DepartamentoFila) {
    const n = draft.nombre.trim();
    if (!n) {
      toast('El nombre del departamento es obligatorio', 'error');
      return;
    }
    const cambios: { nombre?: string; responsableId?: string | null } = {};
    if (n !== d.nombre) cambios.nombre = n;
    if ((draft.responsable || null) !== d.responsableId) cambios.responsableId = draft.responsable || null;
    if (Object.keys(cambios).length === 0) {
      toast('No hay cambios que guardar');
      return;
    }
    setGuardando(true);
    const { error } = await actualizar(d.id, cambios);
    setGuardando(false);
    if (error) toast(error, 'error');
    else {
      toast('Departamento actualizado');
      setEditando(null);
    }
  }

  async function onDesactivar(d: DepartamentoFila) {
    const motivo = motivoNoDesactivable(d);
    if (motivo) {
      toast(motivo, 'error');
      return;
    }
    if (!confirmar(`¿Desactivar el departamento ${d.nombre}? Dejará de ofrecerse al dar de alta o editar profesionales y especialidades. Puedes reactivarlo cuando quieras.`)) return;
    setGuardando(true);
    const { error } = await actualizar(d.id, { activo: false });
    setGuardando(false);
    if (error) toast(error, 'error');
    else {
      toast(`Departamento ${d.nombre} desactivado`);
      setEditando(null);
    }
  }

  async function onReactivar(d: DepartamentoFila) {
    setGuardando(true);
    const { error } = await actualizar(d.id, { activo: true });
    setGuardando(false);
    if (error) toast(error, 'error');
    else toast(`Departamento ${d.nombre} reactivado`);
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
          <div id="form-nuevo-departamento" className="card-body border-b border-border" data-testid="form-nuevo-departamento">
            <h3 className="mb-3 text-[13px] font-extrabold">Crear departamento</h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-3">
              <div>
                <label className={etiqueta} htmlFor="departamento-nombre">
                  Nombre
                </label>
                <input id="departamento-nombre" className="input" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tecnología" />
              </div>
              <div>
                <label className={etiqueta} htmlFor="departamento-responsable">
                  Responsable
                </label>
                <select id="departamento-responsable" className="input" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                  <option value="">Sin responsable</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-primary mt-4" disabled={guardando} onClick={onCrear}>
              {guardando ? 'Creando…' : 'Crear departamento'}
            </button>
          </div>
        )}

        <div className="px-1.5 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                <th className="border-b border-border px-2.5 py-2">Departamento</th>
                <th className="border-b border-border px-2.5 py-2">Responsable</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Especialidades</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Profesionales</th>
                <th className="border-b border-border px-2.5 py-2">Estado</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && departamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2.5 py-4 text-sm text-ink-tertiary" data-testid="departamentos-vacio">
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
                  draft={draft}
                  setDraft={setDraft}
                  personas={personas}
                  guardando={guardando}
                  onAbrir={() => abrirEdicion(d)}
                  onGuardar={() => onGuardar(d)}
                  onDesactivar={() => onDesactivar(d)}
                  onReactivar={() => onReactivar(d)}
                />
              ))}
            </tbody>
          </table>
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
            El responsable de departamento aprueba ausencias y vigila las imputaciones faltantes de su equipo. Un departamento con especialidades activas o profesionales en activo no se
            puede desactivar: reubícalos antes.
          </p>
        </div>
      </div>
    </div>
  );
}

function FilaDepartamento({
  d,
  abierta,
  draft,
  setDraft,
  personas,
  guardando,
  onAbrir,
  onGuardar,
  onDesactivar,
  onReactivar,
}: {
  d: DepartamentoFila;
  abierta: boolean;
  draft: { nombre: string; responsable: string };
  setDraft: (v: { nombre: string; responsable: string }) => void;
  personas: { id: string; nombre: string }[];
  guardando: boolean;
  onAbrir: () => void;
  onGuardar: () => void;
  onDesactivar: () => void;
  onReactivar: () => void;
}) {
  const motivo = motivoNoDesactivable(d);
  return (
    <>
      <tr className={`row-link hover:bg-subtle ${d.activo ? '' : 'opacity-60'}`} onClick={(ev) => !(ev.target as HTMLElement).closest('button') && onAbrir()} data-testid={`departamento-${d.nombre}`}>
        <td className="border-b border-border px-2.5 py-2.5 font-extrabold">
          {d.nombre}
          {!d.activo && <span className="mapa-tag ml-2 align-middle">Inactivo</span>}
        </td>
        <td className="border-b border-border px-2.5 py-2.5">{d.responsableNombre ?? '—'}</td>
        <td className="mono border-b border-border px-2.5 py-2.5 text-right">{d.especialidades}</td>
        <td className="mono border-b border-border px-2.5 py-2.5 text-right">{d.profesionales}</td>
        <td className="border-b border-border px-2.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
            <span className={`h-[7px] w-[7px] rounded-full ${d.activo ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
            {d.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td className="border-b border-border px-2.5 py-2.5 text-right">
          <button type="button" className="btn btn-sm" aria-expanded={abierta} onClick={onAbrir}>
            {abierta ? 'Cerrar' : 'Editar'}
          </button>
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={6} className="border-b border-border bg-subtle px-3 py-3" data-testid="edicion-departamento">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-3">
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={guardando} onClick={onGuardar}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {d.activo ? (
                <button type="button" className="btn btn-sm" disabled={guardando} onClick={onDesactivar} title={motivo ?? undefined}>
                  Desactivar
                </button>
              ) : (
                <button type="button" className="btn btn-sm" disabled={guardando} onClick={onReactivar}>
                  Reactivar
                </button>
              )}
              {d.activo && motivo && <span className="text-xs text-ink-tertiary">{motivo}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
