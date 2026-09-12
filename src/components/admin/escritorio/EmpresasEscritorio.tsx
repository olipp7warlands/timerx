'use client';

import { useState } from 'react';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useHorasPorEmpresaYProyecto } from '@/hooks/admin/useHorasPorEmpresaYProyecto';
import { useRefacturacion } from '@/hooks/admin/useRefacturacion';
import { useProyectosAdmin } from '@/hooks/admin/useProyectosAdmin';
import { useUsuarios } from '@/hooks/admin/useUsuarios';
import { useToast } from '@/components/empleado/compartido/Toast';
import { Donut } from '../compartido/Donut';
import { FichaEmpresaEscritorio } from './FichaEmpresaEscritorio';
import { fmt, formatoMes } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

const GRISES = ['var(--ink-primary)', 'var(--ink-secondary)', 'var(--ink-tertiary)', 'var(--ink-disabled)', 'var(--border-strong)'];

interface Props {
  info: AdminInfo;
  onIrAProyecto: (proyectoId: string) => void;
  onIrAUsuario: (usuarioId: string) => void;
  onIrAInvitarUsuario: (empresaId: string) => void;
  onIrARefacturacion: () => void;
}

export function EmpresasEscritorio({ info, onIrAProyecto, onIrAUsuario, onIrAInvitarUsuario, onIrARefacturacion }: Props) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const { empresas, crear, actualizar, desactivar } = useEmpresas();
  const { porEmpresa, porProyecto } = useHorasPorEmpresaYProyecto(anio, mes);
  const { lineas: refact } = useRefacturacion(anio, mes);
  const { proyectos, crear: crearProyecto } = useProyectosAdmin();
  const { usuarios } = useUsuarios();
  const toast = useToast();

  const esAdminGrupo = info.rol === 'admin_grupo';
  const [nombre, setNombre] = useState('');
  const [cif, setCif] = useState('');
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const seleccionado = empresas.find((e) => e.id === seleccionadoId) ?? null;

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

  if (seleccionado) {
    return (
      <FichaEmpresaEscritorio
        info={info}
        empresa={seleccionado}
        proyectos={proyectos}
        usuarios={usuarios}
        refacturacion={refact}
        porProyecto={porProyecto}
        horasEmpresa={porEmpresa.find((e) => e.empresaId === seleccionado.id)?.horas ?? 0}
        mes={mes}
        onVolver={() => setSeleccionadoId(null)}
        onActualizar={actualizar}
        onDesactivar={desactivar}
        onCrearProyecto={crearProyecto}
        onIrAProyecto={onIrAProyecto}
        onIrAUsuario={onIrAUsuario}
        onIrAInvitarUsuario={onIrAInvitarUsuario}
        onIrARefacturacion={onIrARefacturacion}
      />
    );
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
              <span className="micro">{formatoMes(mes)}</span>
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
                {empresas.map((e) => {
                  const horasEmpresa = porEmpresa.find((p) => p.empresaId === e.id)?.horas ?? 0;
                  const proyectosActivos = proyectos.filter((p) => p.empresaId === e.id && p.activo).length;
                  const importe = refact.filter((l) => l.empresaDestinoId === e.id).reduce((s, l) => s + l.importe, 0);
                  return (
                    <tr
                      key={e.id}
                      className="row-link hover:bg-subtle"
                      onClick={(ev) => {
                        if (!(ev.target as HTMLElement).closest('button')) setSeleccionadoId(e.id);
                      }}
                    >
                      <td className="border-b border-border px-2.5 py-2.5 font-extrabold">{e.nombre}</td>
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
                        <button type="button" className="btn btn-sm" onClick={() => setSeleccionadoId(e.id)}>
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
