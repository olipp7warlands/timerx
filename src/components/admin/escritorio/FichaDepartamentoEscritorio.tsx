'use client';

import { useState } from 'react';
import { especialidadesActivas, motivoNoDesactivable, type DepartamentoFila, type EmpresaOpcion, type Persona, type useDepartamentosAdmin } from '@/hooks/admin/useDepartamentosAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { confirmar } from '@/components/ui/confirmar';
import { useNavAdmin } from '../NavAdmin';
import { colorDeClave } from '@/lib/horas/colores-departamento';
import { SelectorColor } from '../compartido/SelectoresDepartamento';

const etiqueta = 'mb-1 block text-xs font-extrabold text-ink-tertiary';

type Acciones = Pick<ReturnType<typeof useDepartamentosAdmin>, 'actualizar' | 'fijarEmpresa' | 'crearEspecialidad' | 'actualizarEspecialidad'>;

/**
 * Ficha de un departamento (`/admin/departamentos/<id>`), mismo patrón que las fichas de empresa y usuario: cabecera, «Datos»,
 * «Especialidades» y «Acciones». Renombrar el departamento renombra su categoría espejo en la misma transacción (trigger de la 030).
 */
export function FichaDepartamentoEscritorio({ d, personas, empresas, onVolver, acciones }: { d: DepartamentoFila; personas: Persona[]; empresas: EmpresaOpcion[]; onVolver: () => void; acciones: Acciones }) {
  const toast = useToast();
  const nav = useNavAdmin();
  const motivo = motivoNoDesactivable(d);
  const [guardando, setGuardando] = useState(false);
  const [draft, setDraft] = useState({ nombre: d.nombre, responsable: d.responsableId ?? '', color: d.color });
  const [nuevaEsp, setNuevaEsp] = useState('');
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);

  async function guardar() {
    const n = draft.nombre.trim();
    if (!n) return toast('El nombre del departamento es obligatorio', 'error');
    const cambios: { nombre?: string; responsableId?: string | null; color?: string | null } = {};
    if (n !== d.nombre) cambios.nombre = n;
    if ((draft.responsable || null) !== d.responsableId) cambios.responsableId = draft.responsable || null;
    if (draft.color !== d.color) cambios.color = draft.color;
    if (Object.keys(cambios).length === 0) return toast('No hay cambios que guardar');
    setGuardando(true);
    const { error } = await acciones.actualizar(d.id, cambios);
    setGuardando(false);
    toast(error ?? 'Datos actualizados', error ? 'error' : undefined);
  }

  async function alternarEmpresa(e: EmpresaOpcion, existe: boolean) {
    setGuardando(true);
    const { error } = await acciones.fijarEmpresa(d.id, e.id, existe);
    setGuardando(false);
    toast(error ?? (existe ? `${d.nombre} añadido a ${e.nombre}` : `${d.nombre} quitado de ${e.nombre}`), error ? 'error' : undefined);
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
    <div data-testid="ficha-departamento">
      <button type="button" className="btn btn-sm" onClick={onVolver}>
        ‹ Volver a departamentos
      </button>

      <div className="my-4 flex flex-wrap items-center gap-3.5">
        <span className="h-11 w-11 shrink-0 rounded-full" style={{ background: colorDeClave(d.color) }} aria-hidden="true" data-testid="ficha-departamento-color" />
        <div>
          <h2 className="text-xl font-extrabold">{d.nombre}</h2>
          <p className="micro mt-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-[7px] w-[7px] rounded-full ${d.activo ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
              {d.activo ? 'Activo' : 'Inactivo'}
            </span>{' '}
            · {especialidadesActivas(d)} especialidad{especialidadesActivas(d) === 1 ? '' : 'es'} activa{especialidadesActivas(d) === 1 ? '' : 's'} · {d.profesionales} profesional{d.profesionales === 1 ? '' : 'es'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-3.5">
        <div className="card" data-testid="card-datos-departamento">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Datos del departamento</h2>
          </div>
          <div className="card-body space-y-3">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-3">
              <div>
                <label className={etiqueta} htmlFor="departamento-ficha-nombre">
                  Nombre
                </label>
                <input id="departamento-ficha-nombre" className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="departamento-ficha-responsable">
                  Responsable
                </label>
                <select id="departamento-ficha-responsable" className="input" value={draft.responsable} onChange={(e) => setDraft({ ...draft, responsable: e.target.value })}>
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
            <button type="button" className="btn btn-primary" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>

        <div className="card" data-testid="empresas-departamento">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">
              Empresas donde existe{' '}
              <span className="micro font-bold">
                · {d.empresaIds.length} de {empresas.length}
              </span>
            </h2>
          </div>
          <div className="card-body">
            <ul className="space-y-1">
              {empresas.map((e) => {
                const existe = d.empresaIds.includes(e.id);
                const gente = d.profesionalesPorEmpresa[e.id] ?? 0;
                return (
                  <li key={e.id} className={`flex items-center gap-3 rounded-lg bg-subtle px-2.5 py-1.5 text-sm ${existe ? '' : 'opacity-70'}`} data-testid={`empresa-departamento-${e.nombre}`}>
                    <input type="checkbox" aria-label={`${d.nombre} existe en ${e.nombre}`} checked={existe} disabled={guardando} onChange={(ev) => alternarEmpresa(e, ev.target.checked)} />
                    <button type="button" className="btn-text flex-1 text-left font-bold" onClick={() => nav.ir('empresas', { fichaId: e.id })}>
                      {e.nombre}
                    </button>
                    <span className="mono text-xs text-ink-tertiary">
                      {gente} profesional{gente === 1 ? '' : 'es'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-tertiary">Una empresa con profesionales asignados a este departamento no se puede quitar: reubícalos antes.</p>
          </div>
        </div>

        <div className="card" data-testid="especialidades-departamento">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">
              Especialidades <span className="micro font-bold">· {especialidadesActivas(d)} activas</span>
            </h2>
          </div>
          <div className="card-body space-y-2">
            {d.especialidades.length === 0 && <p className="text-xs text-ink-tertiary">Aún no tiene especialidades — añade la primera.</p>}
            <ul className="space-y-1">
              {d.especialidades.map((e) => (
                <li key={e.id} className={`flex items-center gap-2 rounded-lg bg-subtle px-2.5 py-1.5 text-sm ${e.activa ? '' : 'opacity-60'}`}>
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
          </div>
        </div>

        <div className="card" data-testid="card-acciones-departamento">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Acciones</h2>
          </div>
          <div className="card-body space-y-2">
            {d.activo ? (
              <>
                <button type="button" className="btn" disabled={guardando} onClick={desactivar}>
                  Desactivar departamento
                </button>
                {motivo && <p className="text-xs text-ink-tertiary">{motivo}</p>}
              </>
            ) : (
              <button type="button" className="btn" disabled={guardando} onClick={reactivar}>
                Reactivar departamento
              </button>
            )}
            <p className="text-xs text-ink-tertiary">Un departamento desactivado deja de ofrecerse al dar de alta profesionales y al imputar. Puedes reactivarlo cuando quieras.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
