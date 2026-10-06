'use client';

import { useEffect, useState } from 'react';
import { especialidadesActivas, useDepartamentosAdmin, type DepartamentoFila, type EmpresaOpcion } from '@/hooks/admin/useDepartamentosAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { colorDeClave } from '@/lib/horas/colores-departamento';
import { PREDEFINIDOS } from '@/lib/departamentos/predefinidos';
import { ImportadorBloque } from '../compartido/ImportadorBloque';
import { SelectorColor, SelectorEmpresas } from '../compartido/SelectoresDepartamento';
import { useNavAdmin } from '../NavAdmin';
import { FichaDepartamentoEscritorio } from './FichaDepartamentoEscritorio';
import type { AdminInfo } from '../types';

const etiqueta = 'mb-1 block text-xs font-extrabold text-ink-tertiary';

/**
 * /admin/departamentos — v2.0: FUSIONA Departamentos y Especialidades. Solo admin_grupo (la sección ni se ofrece a admin_empresa y la
 * page lo redirige; la RLS de la 024 es la barrera real). Listado (color, responsable, empresas, nº especialidades, nº profesionales)
 * + «＋ Nuevo departamento» desplegable (lista predefinida y/o personalizado). La edición vive en la FICHA (`/admin/departamentos/<id>`),
 * el mismo patrón listado → detalle que Empresas y Usuarios.
 */
export function DepartamentosEscritorio({ info }: { info: AdminInfo }) {
  const toast = useToast();
  const nav = useNavAdmin();
  const { departamentos, personas, empresas, loading, recargar, crear, actualizar, fijarEmpresa, crearEspecialidad, actualizarEspecialidad } = useDepartamentosAdmin();
  const [formAbierto, setFormAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [personalizado, setPersonalizado] = useState('');
  const [colorNuevo, setColorNuevo] = useState<string | null>(null);
  const [empresasNuevo, setEmpresasNuevo] = useState<string[] | null>(null); // null = todas (por defecto, D4/D9)
  const [guardando, setGuardando] = useState(false);

  // Ficha derivada de la URL. Con los datos aún cargando se ESPERA (nunca se redirige al listado); si tras cargar el id no existe, listado con aviso.
  const seleccionado = nav.fichaId ? departamentos.find((d) => d.id === nav.fichaId) ?? null : null;
  const fichaInexistente = !!nav.fichaId && !loading && !seleccionado;
  useEffect(() => {
    if (!fichaInexistente) return;
    toast('Ese departamento no existe', 'error');
    nav.ir('departamentos', { reemplazar: true });
  }, [fichaInexistente]); // eslint-disable-line react-hooks/exhaustive-deps

  if (info.rol !== 'admin_grupo') return <p className="p-4 text-sm text-ink-tertiary">Los departamentos los gestiona el admin del grupo.</p>;

  if (nav.fichaId) {
    if (!seleccionado) return <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
    return (
      <FichaDepartamentoEscritorio
        d={seleccionado}
        personas={personas}
        empresas={empresas}
        onVolver={() => nav.ir('departamentos')}
        acciones={{ actualizar, fijarEmpresa, crearEspecialidad, actualizarEspecialidad }}
      />
    );
  }

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
      // Un alta única lleva a la ficha recién creada; un alta múltiple se queda en el listado.
      if (r.ids.length === 1) nav.ir('departamentos', { fichaId: r.ids[0] });
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
                <th className="border-b border-border px-2.5 py-2 text-right"></th>
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
                <FilaDepartamento key={d.id} d={d} empresas={empresas} onAbrir={() => nav.ir('departamentos', { fichaId: d.id })} />
              ))}
            </tbody>
          </table>
          <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">
            Un departamento agrupa a las personas y a las especialidades que se imputan. El responsable aprueba ausencias y vigila las imputaciones faltantes de su equipo. Un departamento con
            especialidades activas o profesionales en activo no se puede desactivar: reubícalos antes.
          </p>
        </div>
      </div>

      <div className="card" data-testid="importar-especialidades">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Importar / Exportar especialidades</h2>
        </div>
        <div className="card-body max-w-3xl">
          <ImportadorBloque
            tipo="categorias"
            titulo="Especialidades"
            descripcion="Altas masivas desde Excel, una fila por especialidad con su departamento. Los departamentos deben existir ya y estar activos. Todo o nada."
            exportHref="/api/export/categorias"
            exportEtiqueta="Exportar especialidades"
            onImportado={recargar}
          />
        </div>
      </div>
    </div>
  );
}

function FilaDepartamento({ d, empresas, onAbrir }: { d: DepartamentoFila; empresas: EmpresaOpcion[]; onAbrir: () => void }) {
  const nombresEmpresas = d.empresaIds.length === empresas.length && empresas.length > 0 ? `Todas (${empresas.length})` : empresas.filter((e) => d.empresaIds.includes(e.id)).map((e) => e.nombre).join(', ') || '—';
  return (
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
        <button type="button" className="btn btn-sm" onClick={onAbrir}>
          Ver
        </button>
      </td>
    </tr>
  );
}
