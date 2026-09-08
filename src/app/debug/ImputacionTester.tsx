'use client';

import { useMemo, useState } from 'react';
import { ToastProvider, useToast } from '@/components/empleado/compartido/Toast';
import { FilaDia } from '@/components/empleado/compartido/FilaDia';
import { Stepper } from '@/components/empleado/compartido/Stepper';
import { CalendarGrid } from '@/components/empleado/compartido/CalendarGrid';
import { useDiasMes } from '@/hooks/useDiasMes';
import { useImputacionesMes } from '@/hooks/useImputacionesMes';
import { useAusenciasMes } from '@/hooks/useAusenciasMes';
import { useProyectosAsignados } from '@/hooks/useProyectosAsignados';
import { useCategoriasTareas } from '@/hooks/useCategoriasTareas';
import { useMaxHorasDia } from '@/hooks/useMaxHorasDia';
import { fmt, rangoDias } from '@/lib/horas/calendario';

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function ImputacionTesterInterno({ empresaId }: { empresaId: string }) {
  const toast = useToast();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const fechaHoy = hoyISO();

  const { dias, loading: loadingDias } = useDiasMes(anio, mes, empresaId);
  const { porDia, insertar, insertarLote, ajustarHoras, eliminar } = useImputacionesMes(anio, mes);
  const { ausencias, solicitar } = useAusenciasMes(anio, mes);
  const { paraFechas } = useProyectosAsignados();
  const proyectos = paraFechas([fechaHoy]);
  const { grupos } = useCategoriasTareas();
  const { maxHorasDia } = useMaxHorasDia();

  const [proyectoId, setProyectoId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [horas, setHoras] = useState(1);
  const [rangoInicio, setRangoInicio] = useState<string | null>(null);
  const [rangoFin, setRangoFin] = useState<string | null>(null);
  const [ultimoResultadoLote, setUltimoResultadoLote] = useState<string | null>(null);

  const proyectoActivo = proyectoId || proyectos[0]?.id || '';
  const subcategoriaActiva = subcategoriaId || grupos[0]?.subcategorias[0]?.id || '';

  async function onInsertar() {
    if (!proyectoActivo || !subcategoriaActiva) {
      toast('Elige proyecto y tarea primero', 'error');
      return;
    }
    const { error } = await insertar({ proyectoId: proyectoActivo, subcategoriaId: subcategoriaActiva, horas, fecha: fechaHoy });
    if (error) toast(error, 'error');
    else toast(`Insertado borrador · ${fmt(horas)} h`);
  }

  async function onProbarLoteAtomico() {
    if (!proyectoActivo || !subcategoriaActiva || !maxHorasDia) {
      toast('Faltan datos para la prueba (proyecto/tarea/tope)', 'error');
      return;
    }
    const antes = (porDia[fechaHoy] ?? []).length;
    // Dos líneas cuya suma supera el tope diario: el lote entero debe fallar.
    const { error } = await insertarLote([
      { proyectoId: proyectoActivo, subcategoriaId: subcategoriaActiva, horas: maxHorasDia, fecha: fechaHoy },
      { proyectoId: proyectoActivo, subcategoriaId: subcategoriaActiva, horas: 1, fecha: fechaHoy },
    ]);
    const despues = (porDia[fechaHoy] ?? []).length;
    setUltimoResultadoLote(
      error
        ? `Lote RECHAZADO (correcto) · mensaje del trigger: "${error}" · líneas antes=${antes} después=${despues}`
        : `Lote ACEPTADO (inesperado) · líneas antes=${antes} después=${despues}`
    );
    toast(error ?? 'El lote se insertó sin error (inesperado)', error ? 'error' : 'info');
  }

  function onClickDiaRango(fecha: string) {
    if (!rangoInicio || (rangoInicio && rangoFin)) {
      setRangoInicio(fecha);
      setRangoFin(null);
      return;
    }
    if (fecha < rangoInicio) {
      setRangoFin(rangoInicio);
      setRangoInicio(fecha);
    } else {
      setRangoFin(fecha);
    }
  }

  async function onSolicitarAusencia() {
    if (!rangoInicio) {
      toast('Marca un rango en el calendario (primer toque = inicio, segundo = fin)', 'error');
      return;
    }
    const fin = rangoFin ?? rangoInicio;
    const { error } = await solicitar('vacaciones', rangoInicio, fin, 'Solicitud de prueba (/debug)');
    if (error) toast(error, 'error');
    else {
      toast(`Ausencia solicitada · ${rangoDias(rangoInicio, fin)}`);
      setRangoInicio(null);
      setRangoFin(null);
    }
  }

  const lineasHoy = porDia[fechaHoy] ?? [];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-head">
          <h2>Días del mes ({loadingDias ? 'cargando…' : `${dias.length} días`})</h2>
        </div>
        <div className="card-body flex flex-wrap gap-1 text-xs">
          {dias.map((d) => (
            <span
              key={d.fecha}
              className={`mono rounded px-1.5 py-0.5 ${d.laborable ? 'bg-subtle' : 'text-ink-disabled line-through'}`}
            >
              {d.fecha.slice(-2)}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Hoy ({fechaHoy}) — tope diario: {maxHorasDia != null ? `${fmt(maxHorasDia)} h` : '…'}</h2>
        </div>
        <div className="card-body space-y-3">
          {lineasHoy.length === 0 && <p className="text-sm text-ink-tertiary">Sin imputaciones hoy.</p>}
          {lineasHoy.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-border pb-2 text-sm">
              <span>
                {l.proyectoNombre} · {l.subcategoriaNombre} <span className="micro">({l.estado})</span>
              </span>
              <span className="flex items-center gap-3">
                <Stepper value={l.horas} onChange={(v) => ajustarHoras(l.id, v).then((r) => r.error && toast(r.error, 'error'))} />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => eliminar(l.id).then((r) => (r.error ? toast(r.error, 'error') : toast('Eliminada')))}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-3 pt-2">
            <label className="text-xs">
              Proyecto
              <select className="input" value={proyectoActivo} onChange={(e) => setProyectoId(e.target.value)}>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {p.empresaNombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Tarea
              <select className="input" value={subcategoriaActiva} onChange={(e) => setSubcategoriaId(e.target.value)}>
                {grupos.map((g) => (
                  <optgroup key={g.categoriaId} label={g.categoriaNombre}>
                    {g.subcategorias.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <Stepper value={horas} onChange={setHoras} />
            <button type="button" className="btn btn-primary btn-sm" onClick={onInsertar}>
              Insertar borrador (prueba)
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Prueba de atomicidad del lote</h2>
        </div>
        <div className="card-body space-y-2">
          <p className="text-sm text-ink-tertiary">
            Inserta 2 líneas en una sola llamada donde la suma supera el tope diario ({maxHorasDia != null ? fmt(maxHorasDia) : '…'} h) — debe fallar TODO el lote, sin dejar ninguna línea a medias.
          </p>
          <button type="button" className="btn btn-sm" onClick={onProbarLoteAtomico}>
            Probar lote atómico (debe fallar)
          </button>
          {ultimoResultadoLote && <p className="mono text-xs">{ultimoResultadoLote}</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Solicitar ausencia — selector de rango de dos toques</h2>
        </div>
        <div className="card-body space-y-3">
          <p className="text-sm text-ink-tertiary">
            Primer toque = inicio, segundo toque = fin (pinta el rango), tercer toque reinicia. Seleccionado:{' '}
            {rangoInicio ? rangoDias(rangoInicio, rangoFin ?? rangoInicio) : 'ninguno'}.
          </p>
          <div className="max-w-xs">
            <CalendarGrid
              dias={dias}
              estadoDia={() => 'no-laborable'}
              claseExtra={(d) => {
                if (!rangoInicio) return '';
                const fin = rangoFin ?? rangoInicio;
                return d.fecha >= rangoInicio && d.fecha <= fin ? 'bg-accent text-on-accent border-accent' : '';
              }}
              onClickDia={onClickDiaRango}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSolicitarAusencia}>
            Solicitar ausencia de prueba
          </button>
          <ul className="space-y-1 text-xs">
            {ausencias.map((a) => (
              <li key={a.id} className="mono">
                {a.tipo} · {a.fechaInicio} → {a.fechaFin} · {a.estado}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ImputacionTester({ empresaId }: { empresaId: string }) {
  return (
    <ToastProvider>
      <ImputacionTesterInterno empresaId={empresaId} />
    </ToastProvider>
  );
}
