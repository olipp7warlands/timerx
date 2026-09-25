'use client';

import { useAreasTipologia } from '@/hooks/admin/useAreasTipologia';
import { coloresRosco } from '@/lib/mapa/colores';
import { useEffect, useState } from 'react';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useHorasPorEmpresaYProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useRefacturacion } from '@/hooks/admin/useRefacturacion';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useToast } from '@/components/empleado/compartido/Toast';
import { Donut } from '../compartido/Donut';
import { ImportadorBloque } from '../compartido/ImportadorBloque';
import { SelectorTipologia, SIN_TIPOLOGIA, areaDeSelector } from '../compartido/SelectorTipologia';
import { FichaEmpresaEscritorio } from './FichaEmpresaEscritorio';
import { useNavAdmin } from '../NavAdmin';
import { fmt, formatoMes } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

export function EmpresasEscritorio({ info }: { info: AdminInfo }) {
  const nav = useNavAdmin();
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const { empresas, loading, recargar, crear, actualizar, desactivar } = useEmpresas();
  const { porEmpresa, porProyecto } = useHorasPorEmpresaYProyecto(anio, mes);
  const { areas, colorDe } = useAreasTipologia();
  const { lineas: refact } = useRefacturacion(anio, mes);
  const { proyectos, crear: crearProyecto } = useProyectosAdmin();
  const { usuarios } = useUsuarios();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [nombre, setNombre] = useState('');
  const [cif, setCif] = useState('');
  const [tipologia, setTipologia] = useState(SIN_TIPOLOGIA);

  // Ficha derivada de la URL. Con `empresas` aún cargando se ESPERA (nunca se redirige al listado);
  // solo si tras cargar el id no existe se vuelve al listado con aviso.
  const seleccionado = nav.fichaId ? empresas.find((e) => e.id === nav.fichaId) ?? null : null;
  const fichaInexistente = !!nav.fichaId && !loading && !seleccionado;
  useEffect(() => {
    if (!fichaInexistente) return;
    toast('Esa empresa no existe', 'error');
    nav.ir('empresas', { reemplazar: true });
  }, [fichaInexistente]); // eslint-disable-line react-hooks/exhaustive-deps

  async function crearEmpresa() {
    if (!nombre) return;
    const { error } = await crear(nombre, cif || null, areaDeSelector(tipologia, null));
    if (error) toast(error, 'error');
    else {
      toast(`Empresa "${nombre}" creada`);
      setNombre('');
      setCif('');
      setTipologia(SIN_TIPOLOGIA);
    }
  }

  if (nav.fichaId) {
    if (!seleccionado) return <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
    return (
      <FichaEmpresaEscritorio
        info={info}
        empresa={seleccionado}
        proyectos={proyectos}
        areas={areas}
        usuarios={usuarios}
        refacturacion={refact}
        porProyecto={porProyecto}
        horasEmpresa={porEmpresa.find((e) => e.empresaId === seleccionado.id)?.horas ?? 0}
        mes={mes}
        onVolver={() => nav.ir('empresas')}
        onActualizar={actualizar}
        onDesactivar={desactivar}
        onCrearProyecto={crearProyecto}
        onIrAProyecto={(proyectoId) => nav.ir('proyectos', { fichaId: proyectoId })}
        onIrAUsuario={(usuarioId) => nav.ir('usuarios', { fichaId: usuarioId })}
        onIrAInvitarUsuario={(empresaId) => nav.ir('usuarios', { query: { invitar: empresaId } })}
        onIrARefacturacion={() => nav.ir('refacturacion')}
      />
    );
  }

  const totalHoras = porEmpresa.reduce((s, e) => s + e.horas, 0);
  const coloresEmpresas = coloresRosco(porEmpresa.map((e) => e.areaId), colorDe);

  return (
    <div className="space-y-4">
      <div className="split grid grid-cols-[300px_minmax(0,1fr)] items-start gap-4.5 max-[920px]:grid-cols-1">
        <div className="stack space-y-4">
          {esAdminGrupo && (
            <div className="card">
              <div className="card-head">
                <h2 className="text-sm font-extrabold">Crear empresa</h2>
              </div>
              <div className="card-body">
                <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
                <input id="empresa-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Wowinx SL" />
                <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">CIF</label>
                <input className="input mono" value={cif} onChange={(e) => setCif(e.target.value)} placeholder="B-12345678" />
                <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Tipología (área del mapa)</label>
                <SelectorTipologia value={tipologia} onChange={setTipologia} areas={areas} />
                <button type="button" className="btn btn-primary full" onClick={crearEmpresa}>
                  Crear empresa
                </button>
              </div>
            </div>
          )}
          {esAdminGrupo && (
            <div className="card">
              <div className="card-head">
                <h2 className="text-sm font-extrabold">Importar / Exportar</h2>
              </div>
              <div className="card-body">
                <ImportadorBloque
                  tipo="empresas"
                  titulo="Empresas"
                  descripcion="Altas masivas desde Excel. Solo crea empresas nuevas (un nombre existente es un error). Todo o nada; cada empresa nace con su jornada."
                  exportHref="/api/export/empresas"
                  exportEtiqueta="Exportar empresas"
                  onImportado={recargar}
                />
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Horas recibidas</h2>
              <span className="micro">{formatoMes(mes)}</span>
            </div>
            <div className="card-body">
              <Donut total={totalHoras} segmentos={porEmpresa.map((e, i) => ({ etiqueta: e.empresaNombre, valor: e.horas, color: coloresEmpresas[i] }))} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Empresas del grupo</h2>
          </div>
          <div className="px-1.5 pb-2">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Empresa</th>
                  <th className="border-b border-border px-2.5 py-2">CIF</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Proyectos</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Horas · mes</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Refacturación · mes</th>
                  <th className="border-b border-border px-2.5 py-2">Estado</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!loading && empresas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-4 text-sm text-ink-tertiary" data-testid="empresas-vacio">
                      {esAdminGrupo ? (
                        <>
                          Aún no hay empresas — crea la primera con el formulario «Crear empresa».{' '}
                          <button type="button" className="btn-text" onClick={() => document.getElementById('empresa-nombre')?.focus()}>
                            Ir al formulario
                          </button>
                        </>
                      ) : (
                        'Aún no hay empresas en el grupo.'
                      )}
                    </td>
                  </tr>
                )}
                {empresas.map((e) => {
                  const horasEmpresa = porEmpresa.find((p) => p.empresaId === e.id)?.horas ?? 0;
                  const proyectosActivos = proyectos.filter((p) => p.empresaId === e.id && p.activo).length;
                  const importe = refact.filter((l) => l.empresaDestinoId === e.id).reduce((s, l) => s + l.importe, 0);
                  return (
                    <tr
                      key={e.id}
                      className={`row-link hover:bg-subtle ${e.activa ? '' : 'opacity-60'}`}
                      onClick={(ev) => {
                        if (!(ev.target as HTMLElement).closest('button')) nav.ir('empresas', { fichaId: e.id });
                      }}
                    >
                      <td className="border-b border-border px-2.5 py-2.5 font-extrabold">
                        {e.nombre}
                        {!e.activa && <span className="mapa-tag ml-2 align-middle">Inactiva</span>}
                      </td>
                      <td className="mono border-b border-border px-2.5 py-2.5">{e.cif ?? '—'}</td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{proyectosActivos}</td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(horasEmpresa)}</td>
                      <td className="mono border-b border-border px-2.5 py-2.5 text-right">{importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                      <td className="border-b border-border px-2.5 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
                          <span className={`h-[7px] w-[7px] rounded-full ${e.activa ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
                          {e.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="border-b border-border px-2.5 py-2.5 text-right">
                        <button type="button" className="btn btn-sm" onClick={() => nav.ir('empresas', { fichaId: e.id })}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="foot px-3 pb-2.5 pt-3 text-xs text-ink-tertiary">La empresa del proyecto es la que recibe el servicio: contra ella se calcula la refacturación.</p>
          </div>
        </div>
      </div>
      {!esAdminGrupo && <p className="text-xs text-ink-tertiary">El alta de empresas es solo para admin de grupo.</p>}
    </div>
  );
}
