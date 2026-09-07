'use client';

import { useState } from 'react';
import { useCalendarioAdmin } from '@/hooks/admin/useCalendarioAdmin';
import { useDiasMes } from '@/hooks/useDiasMes';
import { useToast } from '@/components/empleado/compartido/Toast';
import { CalendarGrid } from '@/components/empleado/compartido/CalendarGrid';
import { fmt } from '@/lib/horas/calendario';
import type { AdminInfo } from '../types';

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function CalendarioEscritorio({ info }: { info: AdminInfo }) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const esAdminGrupo = info.rol === 'admin_grupo';

  const { jornada, festivos, mesesRequeridos, actualizarJornada, crearFestivo } = useCalendarioAdmin(anio, info.empresaId);
  const { dias } = useDiasMes(anioActual, hoy.getMonth() + 1, info.empresaId);
  const toast = useToast();

  const [jornadaInput, setJornadaInput] = useState(String(jornada));
  const [festivo, setFestivo] = useState({ fecha: '', nombre: '', ambito: 'grupo' });

  async function guardarJornada() {
    const horas = Number(jornadaInput.replace(',', '.'));
    if (!horas || horas <= 0) {
      toast('Introduce un número de horas válido', 'error');
      return;
    }
    const { error } = await actualizarJornada(horas);
    if (error) toast(error, 'error');
    else toast('Jornada actualizada');
  }

  async function onCrearFestivo() {
    if (!festivo.fecha || !festivo.nombre) {
      toast('Fecha y nombre son obligatorios', 'error');
      return;
    }
    const { error } = await crearFestivo(festivo.fecha, festivo.nombre, festivo.ambito === 'grupo' ? null : info.empresaId);
    if (error) toast(error, 'error');
    else {
      toast(`Festivo "${festivo.nombre}" añadido`);
      setFestivo({ fecha: '', nombre: '', ambito: 'grupo' });
    }
  }

  return (
    <div className="split grid grid-cols-2 items-start gap-4.5 max-[920px]:grid-cols-1">
      <div className="stack space-y-4">
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Jornada</h2>
          </div>
          <div className="card-body">
            <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Horas por día laborable</label>
            <div className="flex items-center gap-2">
              <input className="input mono w-[84px] text-center" value={jornadaInput} disabled={!esAdminGrupo} onChange={(e) => setJornadaInput(e.target.value)} />
              {esAdminGrupo && (
                <button type="button" className="btn btn-sm" onClick={guardarJornada}>
                  Guardar
                </button>
              )}
            </div>
            <p className="mt-2.5 text-xs text-ink-tertiary">Las horas requeridas de cada mes se calculan solas: días laborables por jornada, descontando festivos.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Añadir festivo</h2>
          </div>
          <div className="card-body">
            <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Fecha</label>
            <input className="input mono" type="date" value={festivo.fecha} onChange={(e) => setFestivo((f) => ({ ...f, fecha: e.target.value }))} />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Nombre</label>
            <input className="input" value={festivo.nombre} onChange={(e) => setFestivo((f) => ({ ...f, nombre: e.target.value }))} placeholder="Fiesta Nacional" />
            <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Ámbito</label>
            <select className="input" value={festivo.ambito} onChange={(e) => setFestivo((f) => ({ ...f, ambito: e.target.value }))}>
              {esAdminGrupo && <option value="grupo">Todo el grupo</option>}
              <option value="propia">{info.empresaNombre}</option>
            </select>
            <button type="button" className="btn btn-primary full" onClick={onCrearFestivo}>
              Añadir festivo
            </button>
          </div>
        </div>
      </div>

      <div className="stack space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">Vista del mes</h2>
            <span className="micro capitalize">{hoy.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
          </div>
          <CalendarGrid dias={dias} estadoDia={(d) => (!d.laborable ? 'no-laborable' : d.fecha > hoy.toISOString().slice(0, 10) ? 'futuro' : 'incompleto')} onClickDia={() => {}} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2 className="text-sm font-extrabold">Horas requeridas por mes</h2>
            <select className="input w-[110px]" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              <option value={anioActual}>{anioActual}</option>
              <option value={anioActual - 1}>{anioActual - 1}</option>
            </select>
          </div>
          <div className="px-1.5 pb-2">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
                  <th className="border-b border-border px-2.5 py-2">Mes</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Laborables</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Festivos</th>
                  <th className="border-b border-border px-2.5 py-2 text-right">Horas requeridas</th>
                </tr>
              </thead>
              <tbody>
                {mesesRequeridos.map((m) => (
                  <tr key={m.mes} className="hover:bg-subtle">
                    <td className="border-b border-border px-2.5 py-2.5">{NOMBRES_MES[m.mes - 1]}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{m.laborables}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{m.festivos}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(m.horasRequeridas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 pb-2.5 pt-3">
              {festivos
                .filter((f) => f.fecha.startsWith(String(anio)))
                .slice(0, 3)
                .map((f) => (
                  <p key={f.id} className="foot text-xs text-ink-tertiary">
                    <span className="mono">{f.fecha.slice(8, 10)}/{f.fecha.slice(5, 7)}</span> {f.nombre}, {f.empresaNombre ?? 'todo el grupo'}.
                  </p>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
