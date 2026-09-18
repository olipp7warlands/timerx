'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDiasMes } from '@/hooks/useDiasMes';
import { CalendarGrid } from '@/components/empleado/compartido/CalendarGrid';
import { fmt, formatoMesAnio, formatoDiaLargo, type EstadoDia } from '@/lib/horas/calendario';
import type { AusenciaAdmin } from '@/hooks/admin/useAusenciasAdmin';

interface Linea {
  id: string;
  fecha: string;
  horas: number;
  estado: string;
  proyectoNombre: string;
}

const ETIQUETA_ESTADO_LINEA: Record<string, string> = { borrador: 'Borrador', enviada: 'Computada', aprobada: 'Aprobada', rechazada: 'Rechazada', cerrada: 'Cerrada' };
const ETIQUETA_TIPO_AUSENCIA: Record<string, string> = { vacaciones: 'vacaciones', baja_medica: 'baja médica', otro_permiso: 'otro permiso' };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Mini-calendario del mes de UN empleado (ficha de usuario, admin). CERO SQL nueva: los días y su jornada salen de
 * `jornada_dias_mes()` (019, vía useDiasMes) y las líneas de `imputacion` con la RLS del propio admin; la ausencia,
 * de las ausencias ya cargadas por la ficha. Estado por día: al día / incompleto / ausencia / no laborable / futuro.
 * El día seleccionado es efímero (dentro de la ficha), NO va a la URL.
 */
export function MiniCalendarioUsuario({ empleadoId, empresaId, ausencias }: { empleadoId: string; empresaId: string; ausencias: AusenciaAdmin[] }) {
  const hoy = useMemo(() => new Date(), []);
  const hoyISO = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
  const [mes, setMes] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);

  const { dias } = useDiasMes(mes.anio, mes.mes, empresaId);

  useEffect(() => {
    let vigente = true;
    const desde = `${mes.anio}-${pad(mes.mes)}-01`;
    const hasta = `${mes.anio}-${pad(mes.mes)}-${pad(new Date(mes.anio, mes.mes, 0).getDate())}`;
    createClient()
      .from('imputacion')
      .select('id, fecha, horas, estado, proyecto:proyecto_id(nombre)')
      .eq('empleado_id', empleadoId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .then(({ data }) => {
        if (!vigente) return;
        setLineas((data ?? []).map((l) => ({ id: l.id, fecha: l.fecha, horas: Number(l.horas), estado: l.estado, proyectoNombre: l.proyecto?.nombre ?? '—' })));
      });
    return () => {
      vigente = false;
    };
  }, [empleadoId, mes]);

  const aprobadas = useMemo(() => ausencias.filter((a) => a.estado === 'aprobada'), [ausencias]);
  const ausenciaDe = (fecha: string) => aprobadas.find((a) => fecha >= a.fechaInicio && fecha <= a.fechaFin);
  const horasDe = (fecha: string) => lineas.filter((l) => l.fecha === fecha && l.estado !== 'rechazada').reduce((s, l) => s + l.horas, 0);

  function estadoDia(fecha: string, laborable: boolean, jornada: number): EstadoDia {
    if (ausenciaDe(fecha)) return 'futuro'; // punto gris (mock: "off")
    if (!laborable) return 'no-laborable';
    if (fecha > hoyISO) return 'futuro';
    return horasDe(fecha) >= jornada ? 'completo' : 'incompleto';
  }

  function moverMes(delta: number) {
    setDiaSel(null);
    setMes((m) => {
      const d = new Date(m.anio, m.mes - 1 + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  }

  function detalle(fecha: string) {
    const dia = dias.find((d) => d.fecha === fecha);
    const aus = ausenciaDe(fecha);
    const titulo = <b className="font-extrabold text-ink-primary">{formatoDiaLargo(fecha)}</b>;
    if (aus) {
      const rango = aus.fechaInicio === aus.fechaFin ? aus.fechaInicio.split('-').reverse().join('/') : `${aus.fechaInicio.split('-').reverse().join('/')} – ${aus.fechaFin.split('-').reverse().join('/')}`;
      return (
        <p className="text-sm text-ink-secondary">
          {titulo} · Ausencia aprobada: {ETIQUETA_TIPO_AUSENCIA[aus.tipo] ?? aus.tipo} ({rango}).
        </p>
      );
    }
    if (dia && !dia.laborable) return <p className="text-sm text-ink-secondary">{titulo} · Día no laborable (fin de semana o festivo).</p>;
    const delDia = lineas.filter((l) => l.fecha === fecha);
    if (fecha > hoyISO && delDia.length === 0) return <p className="text-sm text-ink-secondary">{titulo} · Futuro, sin actividad.</p>;
    if (delDia.length === 0) return <p className="text-sm text-ink-secondary">{titulo} · Sin imputaciones.</p>;
    return (
      <div>
        <p className="micro mb-1.5">
          {titulo} · {fmt(horasDe(fecha))} h
        </p>
        {delDia.map((l) => (
          <div key={l.id} className={`flex items-center gap-2 border-b border-border py-1.5 text-[13px] ${l.estado === 'rechazada' ? 'text-ink-tertiary line-through' : ''}`}>
            <b className="font-extrabold">{l.proyectoNombre}</b>
            <span className="mono ml-auto">{fmt(l.horas)} h</span>
            <span className="micro w-[78px] text-right">{ETIQUETA_ESTADO_LINEA[l.estado] ?? l.estado}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card mb-4" data-testid="mini-calendario">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Calendario del mes</h2>
        <span className="flex items-center gap-1.5">
          <button type="button" className="btn btn-sm px-2" aria-label="Mes anterior" onClick={() => moverMes(-1)}>
            ‹
          </button>
          <span className="micro min-w-[110px] text-center">{formatoMesAnio(mes.anio, mes.mes)}</span>
          <button type="button" className="btn btn-sm px-2" aria-label="Mes siguiente" onClick={() => moverMes(1)}>
            ›
          </button>
        </span>
      </div>
      <div className="card-body">
        <div className="max-w-[420px]">
          <CalendarGrid
            dias={dias}
            permitirNoLaborables
            estadoDia={(d) => estadoDia(d.fecha, d.laborable, d.jornada)}
            claseExtra={(d) =>
              `${ausenciaDe(d.fecha) ? 'border-ink-disabled' : !d.laborable ? 'bg-subtle text-ink-tertiary' : ''} ${d.fecha === diaSel ? 'ring-2 ring-ink-primary' : ''}`
            }
            onClickDia={setDiaSel}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3.5 text-xs font-bold text-ink-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ink-primary" />
            Al día
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] shrink-0 rounded-full border border-ink-primary" />
            Incompleto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ink-disabled" />
            Ausencia / futuro
          </span>
        </div>
        <div className="mt-3" data-testid="mini-calendario-detalle">
          {diaSel ? detalle(diaSel) : <p className="text-xs text-ink-tertiary">Toca un día para ver sus líneas.</p>}
        </div>
      </div>
    </div>
  );
}
