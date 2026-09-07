'use client';

import { useState } from 'react';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useHorasPorEmpresaYProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useRefacturacion } from '@/hooks/admin/useRefacturacion';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useToast } from '@/components/empleado/compartido/Toast';
import { Donut } from '../compartido/Donut';
import { fmt } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

const GRISES = ['var(--ink-primary)', 'var(--ink-secondary)', 'var(--ink-tertiary)', 'var(--ink-disabled)', 'var(--border-strong)'];

export function EmpresasEscritorio({ info }: { info: AdminInfo }) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const { empresas, crear } = useEmpresas();
  const { porEmpresa } = useHorasPorEmpresaYProyecto(anio, mes);
  const { lineas: refact } = useRefacturacion(anio, mes);
  const { proyectos } = useProyectosAdmin();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [nombre, setNombre] = useState('');
  const [cif, setCif] = useState('');

  async function crearEmpresa() {
    if (!nombre) return;
    const { error } = await crear(nombre, cif || null);
    if (error) toast(error, 'error');
    else {
      toast(`Empresa "${nombre}" creada`);
      setNombre('');
      setCif('');
    }
  }

  const totalHoras = porEmpresa.reduce((s, e) => s + e.horas, 0);

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
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Wowinx SL" />
                <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">CIF</label>
                <input className="input mono" value={cif} onChange={(e) => setCif(e.target.value)} placeholder="B-12345678" />
                <button type="button" className="btn btn-primary full" onClick={crearEmpresa}>
                  Crear empresa
                </button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-head">
              <h2 className="text-sm font-extrabold">Horas recibidas</h2>
              <span className="micro capitalize">{new Date(anio, mes - 1).toLocaleDateString('es-ES', { month: 'long' })}</span>
            </div>
            <div className="card-body">
              <Donut total={totalHoras} segmentos={porEmpresa.map((e, i) => ({ etiqueta: e.empresaNombre, valor: e.horas, color: GRISES[i % GRISES.length] }))} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Empresas del grupo</h2>
          </div>
          <div className="card-body">
            {empresas.map((e) => {
              const horasEmpresa = porEmpresa.find((p) => p.empresaId === e.id)?.horas ?? 0;
              const proyectosActivos = proyectos.filter((p) => p.empresaId === e.id && p.activo).length;
              const importe = refact.filter((l) => l.empresaDestinoId === e.id).reduce((s, l) => s + l.importe, 0);
              return (
                <div key={e.id} className="mb-3 rounded-2xl border border-border bg-surface p-3.5 last:mb-0">
                  <div className="flex items-center justify-between gap-2.5">
                    <h3 className="text-[14.5px] font-extrabold">
                      {e.nombre} <small className="mono ml-1.5 text-[11px] font-normal text-ink-tertiary">{e.cif}</small>
                    </h3>
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
                      <span className={`h-[7px] w-[7px] rounded-full ${e.activa ? 'bg-ink-primary' : 'bg-ink-disabled'}`} />
                      {e.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-border py-2 text-sm">
                    <span>Proyectos activos</span>
                    <span className="mono">{proyectosActivos}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border py-2 text-sm">
                    <span>Horas recibidas · mes</span>
                    <span className="mono">{fmt(horasEmpresa)} h</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border py-2 text-sm">
                    <span>Refacturación · mes</span>
                    <span className="mono">{importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                  </div>
                </div>
              );
            })}
            <p className="foot mt-3 text-xs text-ink-tertiary">La empresa del proyecto es la que recibe el servicio: contra ella se calcula la refacturación.</p>
          </div>
        </div>
      </div>
      {!esAdminGrupo && <p className="text-xs text-ink-tertiary">El alta de empresas es solo para admin de grupo.</p>}
    </div>
  );
}
