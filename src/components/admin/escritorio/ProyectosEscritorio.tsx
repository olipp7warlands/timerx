'use client';

import { useAreasTipologia } from '@/hooks/admin/useAreasTipologia';
import { coloresRosco } from '@/lib/mapa/colores';
import { useEffect, useState } from 'react';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useHorasPorEmpresaYProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useToast } from '@/components/empleado/compartido/Toast';
import { Donut } from '../compartido/Donut';
import { SelectorTipologia, HEREDAR, areaDeSelector } from '../compartido/SelectorTipologia';
import { FichaProyectoEscritorio } from './FichaProyectoEscritorio';
import { useNavAdmin } from '../NavAdmin';
import { fmt, formatoMes } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

export function ProyectosEscritorio({ info }: { info: AdminInfo }) {
  const nav = useNavAdmin();
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const { proyectos, loading, crear, cambiarTipologia } = useProyectosAdmin();
  const { empresas } = useEmpresas();
  const { porProyecto } = useHorasPorEmpresaYProyecto(anio, mes);
  const { areas, colorDe } = useAreasTipologia();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [form, setForm] = useState({ empresaId: info.empresaId, codigo: '', nombre: '', tipologia: HEREDAR });
  // Empresas seleccionables: solo las activas (`empresa.activa` deja de ser decorativa, Lote 4), salvo la ya elegida en el formulario.
  const empresasSeleccionables = empresas.filter((e) => e.activa || e.id === form.empresaId);
  const areaDeLaEmpresa = empresas.find((e) => e.id === form.empresaId)?.areaId ?? null;

  // Ficha derivada de la URL. Con `proyectos` aún cargando se ESPERA (nunca se redirige al listado);
  // solo si tras cargar el id no existe (o la RLS no lo muestra) se vuelve al listado con aviso.
  const seleccionado = nav.fichaId ? proyectos.find((p) => p.id === nav.fichaId) ?? null : null;
  const fichaInexistente = !!nav.fichaId && !loading && !seleccionado;
  useEffect(() => {
    if (!fichaInexistente) return;
    toast('Ese proyecto no existe o no está en tu ámbito', 'error');
    nav.ir('proyectos', { reemplazar: true });
  }, [fichaInexistente]); // eslint-disable-line react-hooks/exhaustive-deps

  async function crearProyecto() {
    if (!form.codigo || !form.nombre) {
      toast('Código y nombre son obligatorios', 'error');
      return;
    }
    const { error } = await crear({ empresaId: form.empresaId, codigo: form.codigo, nombre: form.nombre, areaId: areaDeSelector(form.tipologia, areaDeLaEmpresa) });
    if (error) toast(error, 'error');
    else {
      toast(`Proyecto "${form.nombre}" creado`);
      setForm({ empresaId: info.empresaId, codigo: '', nombre: '', tipologia: HEREDAR });
    }
  }

  if (nav.fichaId) {
    if (!seleccionado) return <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
    const puedeCambiarTipologia = esAdminGrupo || seleccionado.empresaId === info.empresaId;
    return (
      <FichaProyectoEscritorio
        proyecto={seleccionado}
        anio={anio}
        mes={mes}
        areas={areas}
        puedeCambiarTipologia={puedeCambiarTipologia}
        onCambiarTipologia={(areaId) => cambiarTipologia(seleccionado.id, areaId)}
        onVolver={() => nav.ir('proyectos')}
      />
    );
  }

  const totalHoras = porProyecto.reduce((s, p) => s + p.horas, 0);
  const proyectosRosco = porProyecto.slice(0, 6);
  const coloresProyectos = coloresRosco(proyectosRosco.map((p) => p.areaId), colorDe);

  return (
    <div className="split grid grid-cols-[300px_minmax(0,1fr)] items-start gap-4.5 max-[920px]:grid-cols-1">
      <div className="stack space-y-4">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Crear proyecto</h2>
          </div>
          <div className="card-body">
            <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Empresa</label>
            <select className="input" value={form.empresaId} disabled={!esAdminGrupo} onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}>
              {empresasSeleccionables.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Tipología</label>
            <SelectorTipologia value={form.tipologia} onChange={(v) => setForm((f) => ({ ...f, tipologia: v }))} areas={areas} heredarDe={{ areaId: areaDeLaEmpresa }} />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Código</label>
            <input id="proyecto-codigo" className="input mono" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} placeholder="XIM" />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Nombre del proyecto</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ximeras" />
            <button type="button" className="btn btn-primary full" onClick={crearProyecto}>
              Crear proyecto
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Horas por proyecto</h2>
            <span className="micro">{formatoMes(mes)}</span>
          </div>
          <div className="card-body">
            <Donut total={totalHoras} segmentos={proyectosRosco.map((p, i) => ({ etiqueta: p.proyectoNombre, valor: p.horas, color: coloresProyectos[i] }))} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="text-sm font-extrabold">Proyectos</h2>
        </div>
        <div className="px-1.5 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                <th className="border-b border-border px-2.5 py-2">Proyecto</th>
                <th className="border-b border-border px-2.5 py-2">Empresa</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Horas · mes</th>
                <th className="border-b border-border px-2.5 py-2">Estado</th>
                <th className="border-b border-border px-2.5 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && proyectos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2.5 py-4 text-sm text-ink-tertiary" data-testid="proyectos-vacio">
                    Aún no hay proyectos — crea el primero con el formulario «Crear proyecto».{' '}
                    <button type="button" className="btn-text" onClick={() => document.getElementById('proyecto-codigo')?.focus()}>
                      Ir al formulario
                    </button>
                  </td>
                </tr>
              )}
              {proyectos.map((p) => {
                const horas = porProyecto.find((h) => h.proyectoId === p.id)?.horas ?? 0;
                return (
                  <tr
                    key={p.id}
                    className="row-link hover:bg-subtle"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button')) nav.ir('proyectos', { fichaId: p.id });
                    }}
                  >
                    <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{p.nombre}</td>
                    <td className="border-b border-border px-2.5 py-2.5">{p.empresaNombre}</td>
                    <td className={`mono border-b border-border px-2.5 py-2.5 text-right ${horas === 0 ? 'text-ink-tertiary' : ''}`}>{fmt(horas)}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
                        <span className={`h-[7px] w-[7px] rounded-full ${horas > 0 ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
                        {horas > 0 ? 'Activo' : 'Sin actividad'}
                      </span>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right">
                      <button type="button" className="btn btn-sm" onClick={() => nav.ir('proyectos', { fichaId: p.id })}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
