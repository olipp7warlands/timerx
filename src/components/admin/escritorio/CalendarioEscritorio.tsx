'use client';

import { useState } from 'react';
import { useCalendarioAdmin } from '@/hooks/admin/useCalendarioAdmin';
import { useJornadaSemanal } from '@/hooks/admin/useJornadaSemanal';
import { useEmpresas } from '@/hooks/admin/useEmpresas';
import { useEstadoDiasMes } from '@/hooks/admin/useEstadoDiasMes';
import { useResumenDia } from '@/hooks/admin/useResumenDia';
import { useDetalleDia } from '@/hooks/admin/useDetalleDia';
import { useDiasMes } from '@/hooks/useDiasMes';
import { useToast } from '@/components/empleado/compartido/Toast';
import { CalendarGrid } from '@/components/empleado/compartido/CalendarGrid';
import { fmt, formatoMesAnio, formatoMes, formatoDiaLargo } from '@/lib/horas/calendario';
import { useNavAdmin } from '../NavAdmin';
import type { AdminInfo } from '../types';

const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function CalendarioEscritorio({ info }: { info: AdminInfo }) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const [anio, setAnio] = useState(anioActual);
  const esAdminGrupo = info.rol === 'admin_grupo';
  const nav = useNavAdmin();
  const toast = useToast();

  const { empresas } = useEmpresas();
  // Empresa cuya jornada se edita y cuyas requeridas se listan (por defecto, la del propio admin).
  const [empresaId, setEmpresaId] = useState(info.empresaId);
  const { festivos, mesesRequeridos, crearFestivo, recargar: recargarMeses } = useCalendarioAdmin(anio, empresaId);
  const { horas: jornadaGuardada, guardar: guardarSemana } = useJornadaSemanal(empresaId);
  const { dias } = useDiasMes(anioActual, mesActual, info.empresaId);
  const { estadoPorFecha } = useEstadoDiasMes(anioActual, mesActual);

  // Jornada semanal: 7 campos de texto (coma decimal). Lo tecleado (`borrador`) solo vale para la empresa en la que se
  // tecleó; al cambiar de empresa, o tras guardar, se muestra lo guardado en BD.
  const [borrador, setBorrador] = useState<{ empresaId: string; valores: string[] } | null>(null);
  const [guardado, setGuardado] = useState(false);
  const semana = borrador?.empresaId === empresaId ? borrador.valores : jornadaGuardada.map((h) => String(h).replace('.', ','));
  const numero = (v: string) => Number(v.replace(',', '.'));
  const totalSemana = semana.reduce((s, v) => s + (numero(v) || 0), 0);

  const [festivo, setFestivo] = useState({ fecha: '', nombre: '', ambito: 'grupo' });

  async function guardarJornada() {
    const horas = semana.map(numero);
    if (horas.some((h) => Number.isNaN(h) || h < 0 || h > 24)) {
      toast('Cada día debe tener entre 0 y 24 horas', 'error');
      return;
    }
    const { error } = await guardarSemana(horas);
    if (error) toast(error, 'error');
    else {
      setBorrador(null);
      await recargarMeses(); // la tabla "Horas requeridas por mes" depende de la jornada recién guardada
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1600);
    }
  }

  // Día seleccionado en la Vista del mes: vive en la URL (?dia=YYYY-MM-DD) -> compartible y F5 lo conserva.
  const diaParam = nav.consulta.get('dia');
  const diaSel = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) ? diaParam : null;
  function seleccionarDia(fecha: string) {
    nav.ir('calendario', { query: { dia: fecha }, conservarScroll: true });
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
            <h2 className="text-sm font-extrabold">Jornada semanal</h2>
            <span className="micro" data-testid="jornada-total">
              {fmt(totalSemana)} h/sem
            </span>
          </div>
          <div className="card-body">
            <label className="mb-1 block text-xs font-extrabold text-ink-tertiary">Empresa</label>
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas
                .filter((e) => e.activa || e.id === empresaId)
                .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <div className="mt-2.5 grid grid-cols-7 gap-1.5 text-center">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <span key={d} className="micro">
                  {d}
                </span>
              ))}
              {semana.map((v, i) => (
                <input
                  key={i}
                  className="input mono px-0 text-center"
                  aria-label={`Horas del ${NOMBRE_DIA[i]}`}
                  value={v}
                  disabled={!esAdminGrupo}
                  onChange={(e) => setBorrador({ empresaId, valores: semana.map((x, j) => (j === i ? e.target.value : x)) })}
                />
              ))}
            </div>
            {esAdminGrupo && (
              <button type="button" className="btn btn-primary full" disabled={guardado} onClick={guardarJornada}>
                {guardado ? 'Guardado ✓' : 'Guardar jornada'}
              </button>
            )}
            <p className="mt-2.5 text-xs text-ink-tertiary">
              Un día con 0 h no es laborable. Las requeridas del mes suman la jornada de cada día, descontando festivos.
              {!esAdminGrupo && ' Solo el admin del grupo puede modificarla.'}
            </p>
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
            <span className="micro">{formatoMesAnio(anioActual, mesActual)}</span>
          </div>
          <CalendarGrid
            dias={dias}
            permitirNoLaborables
            estadoDia={(d) => estadoPorFecha[d.fecha] ?? 'no-laborable'}
            claseExtra={(d) => (d.fecha === diaSel ? 'ring-2 ring-ink-primary' : '')}
            onClickDia={seleccionarDia}
          />
          <div className="mt-3 flex flex-wrap gap-3.5 text-xs font-bold text-ink-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ink-primary" />
              Completo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full border border-ink-primary" />
              Parcial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ink-disabled" />
              Futuro
            </span>
          </div>
        </div>

        {diaSel && <ResumenDiaCard fecha={diaSel} info={info} />}

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
                    <td className="border-b border-border px-2.5 py-2.5">{formatoMes(m.mes)}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{m.laborables}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right">{m.festivos}</td>
                    <td className="mono border-b border-border px-2.5 py-2.5 text-right" data-testid={`req-mes-${m.mes}`}>
                      {fmt(m.horasRequeridas)}
                    </td>
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
                    <span className="mono">
                      {f.fecha.slice(8, 10)}/{f.fecha.slice(5, 7)}
                    </span>{' '}
                    {f.nombre}, {f.empresaNombre ?? 'todo el grupo'}.
                  </p>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado de la persona ese día, tal como lo decide resumen_dia() (mismas personas que "Faltantes" de Control). */
type EstadoPersona = 'al-dia' | 'falta' | 'ausencia';
const ETIQUETA_ESTADO_PERSONA: Record<EstadoPersona, string> = { 'al-dia': 'Al día', falta: 'Falta', ausencia: 'Ausencia' };
const PUNTO_ESTADO_PERSONA: Record<EstadoPersona, string> = { 'al-dia': 'bg-ink-primary', falta: 'border border-ink-primary', ausencia: 'bg-ink-disabled' };

function ResumenDiaCard({ fecha, info }: { fecha: string; info: AdminInfo }) {
  const [anio, mes] = fecha.split('-').map(Number);
  const { estadoPorFecha, loading: loadingEstado } = useEstadoDiasMes(anio, mes);
  const { resumen, loading: loadingResumen } = useResumenDia(fecha);
  const { personas, loading: loadingDetalle } = useDetalleDia(fecha);
  const estadoDia = estadoPorFecha[fecha];

  let cuerpo: React.ReactNode;
  let subtitulo = '';
  if (loadingEstado || loadingResumen || loadingDetalle) {
    cuerpo = <p className="p-4 text-sm text-ink-tertiary">Cargando…</p>;
  } else if (estadoDia === 'no-laborable') {
    cuerpo = <p className="p-4 text-sm text-ink-tertiary">Día no laborable (fin de semana o festivo) — sin exigencia de horas.</p>;
  } else if (estadoDia === 'futuro') {
    cuerpo = <p className="p-4 text-sm text-ink-tertiary">Día futuro — sin actividad todavía.</p>;
  } else if (!resumen) {
    cuerpo = <p className="p-4 text-sm text-ink-tertiary">Sin datos para este día.</p>;
  } else {
    // resumen_dia() decide el ESTADO (activos de su ámbito; un admin_empresa no cuenta al intragrupo): el detalle
    // de horas y proyectos se añade por persona desde perfil/imputacion con la RLS del propio admin.
    const pendiente = new Map(resumen.pendientes.map((p) => [p.nombre, p]));
    const ausente = new Set(resumen.ausentes.map((a) => a.nombre));
    const filas = personas
      .filter((p) => info.rol === 'admin_grupo' || p.empresaId === info.empresaId)
      .map((p) => {
        const estado: EstadoPersona = ausente.has(p.nombre) ? 'ausencia' : pendiente.has(p.nombre) ? 'falta' : 'al-dia';
        return { ...p, estado, horas: pendiente.get(p.nombre)?.imputado ?? p.horas };
      });
    subtitulo = `${resumen.alDia} de ${resumen.totalEmpleados} al día`;
    cuerpo = (
      <table className="w-full border-collapse text-sm" data-testid="resumen-dia-tabla">
        <thead>
          <tr className="text-left text-[11.5px] font-extrabold text-ink-tertiary">
            <th className="border-b border-border px-2.5 py-2">Persona</th>
            <th className="border-b border-border px-2.5 py-2 text-right">Horas</th>
            <th className="border-b border-border px-2.5 py-2">Proyectos</th>
            <th className="border-b border-border px-2.5 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id}>
              <td className="border-b border-border px-2.5 py-2.5 font-extrabold">
                {p.nombre} <span className="micro font-bold">· {p.empresaNombre}</span>
              </td>
              <td className="mono border-b border-border px-2.5 py-2.5 text-right">{fmt(p.horas)}</td>
              <td className="micro border-b border-border px-2.5 py-2.5">{p.proyectos.length ? p.proyectos.join(' · ') : '—'}</td>
              <td className="border-b border-border px-2.5 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${PUNTO_ESTADO_PERSONA[p.estado]}`} />
                  {ETIQUETA_ESTADO_PERSONA[p.estado]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="card" data-testid="resumen-dia">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Resumen · {formatoDiaLargo(fecha)}</h2>
        <span className="micro">{subtitulo}</span>
      </div>
      <div className="px-1.5 pb-2">{cuerpo}</div>
      {/* Consecuencia correcta de la RLS de `imputacion` (un admin_empresa solo ve imputaciones de proyectos de SU empresa), pero sin aviso parece un descuadre. */}
      {info.rol === 'admin_empresa' && (
        <p className="micro px-3.5 pb-3" data-testid="resumen-dia-aviso">
          Las horas de tu gente en proyectos de otras empresas no se incluyen.
        </p>
      )}
    </div>
  );
}
