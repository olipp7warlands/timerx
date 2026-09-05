'use client';

import { useEffect, useReducer, useState } from 'react';
import { BottomSheet } from '../compartido/BottomSheet';
import { CatDot } from '../compartido/CatDot';
import { Stepper } from '../compartido/Stepper';
import { CalendarGrid } from '../compartido/CalendarGrid';
import { SelectorRangoFechas, type RangoFechas } from '../compartido/SelectorRangoFechas';
import type { EmpleadoCtx } from '../types';

export type Paso = 'tipo' | 'proyecto' | 'tarea' | 'horas' | 'austipo' | 'ausdias';
export type PasoInicial = 'tipo' | 'proyecto';

const TITULO: Record<Paso, string> = {
  tipo: '¿Qué quieres imputar?',
  proyecto: '¿Qué proyecto?',
  tarea: '¿Qué tarea?',
  horas: '¿Cuántas horas?',
  austipo: '¿Qué tipo de ausencia?',
  ausdias: '¿Qué días?',
};

const TIPOS_AUSENCIA: { valor: 'vacaciones' | 'baja_medica' | 'otro_permiso'; etiqueta: string }[] = [
  { valor: 'vacaciones', etiqueta: 'Vacaciones' },
  { valor: 'baja_medica', etiqueta: 'Baja médica' },
  { valor: 'otro_permiso', etiqueta: 'Otro permiso' },
];

interface Sel {
  proyectoId?: string;
  proyectoNombre?: string;
  empresaNombre?: string;
  categoriaNombre?: string;
  subcategoriaId?: string;
  subcategoriaNombre?: string;
  tipoAusencia?: 'vacaciones' | 'baja_medica' | 'otro_permiso';
  tipoAusenciaEtiqueta?: string;
}

interface State {
  pila: Paso[];
  actual: Paso;
  sel: Sel;
  horas: number;
}

type Action =
  | { tipo: 'RESET'; paso: Paso }
  | { tipo: 'AVANZAR'; paso: Paso; sel?: Partial<Sel> }
  | { tipo: 'RETROCEDER' }
  | { tipo: 'SET_HORAS'; horas: number };

function reducer(state: State, action: Action): State {
  switch (action.tipo) {
    case 'RESET':
      return { pila: [], actual: action.paso, sel: {}, horas: 1 };
    case 'AVANZAR':
      return { ...state, pila: [...state.pila, state.actual], actual: action.paso, sel: { ...state.sel, ...action.sel } };
    case 'RETROCEDER': {
      const pila = [...state.pila];
      const anterior = pila.pop();
      return anterior ? { ...state, pila, actual: anterior } : state;
    }
    case 'SET_HORAS':
      return { ...state, horas: action.horas };
  }
}

interface Props {
  ctx: EmpleadoCtx;
  abierto: boolean;
  pasoInicial: PasoInicial;
  destinoStaged: boolean;
  onCerrar: () => void;
}

export function NuevaImputacionSheet({ ctx, abierto, pasoInicial, destinoStaged, onCerrar }: Props) {
  const [state, dispatch] = useReducer(reducer, { pila: [], actual: 'tipo', sel: {}, horas: 1 });
  const [multiDias, setMultiDias] = useState<Set<string>>(new Set());
  const [mostrarCalMulti, setMostrarCalMulti] = useState(false);
  const [rangoAus, setRangoAus] = useState<RangoFechas>({ inicio: null, fin: null });

  useEffect(() => {
    if (abierto) {
      dispatch({ tipo: 'RESET', paso: pasoInicial });
      setMultiDias(new Set([ctx.selDay]));
      setMostrarCalMulti(false);
      setRangoAus({ inicio: null, fin: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, pasoInicial]);

  const crumbs = [state.sel.tipoAusenciaEtiqueta, state.sel.proyectoNombre, state.sel.subcategoriaNombre].filter(Boolean).join(' › ');

  function toggleDiaMulti(fecha: string) {
    setMultiDias((s) => {
      const copia = new Set(s);
      if (copia.has(fecha) && copia.size > 1) copia.delete(fecha);
      else copia.add(fecha);
      return copia;
    });
  }

  async function guardarHoras() {
    if (!state.sel.proyectoId || !state.sel.subcategoriaId) return;
    if (destinoStaged) {
      ctx.anadirLineaStaged({
        proyectoId: state.sel.proyectoId,
        proyectoNombre: state.sel.proyectoNombre!,
        empresaNombre: state.sel.empresaNombre!,
        categoriaNombre: state.sel.categoriaNombre!,
        subcategoriaId: state.sel.subcategoriaId,
        subcategoriaNombre: state.sel.subcategoriaNombre!,
        horas: state.horas,
      });
      onCerrar();
      return;
    }
    // Si falla (p.ej. supera el tope diario), la hoja se queda abierta con la selección intacta
    // para que el usuario vea el error y pueda ajustar horas/días sin repetir todo el wizard.
    const exito = await ctx.guardarHorasMultiDia(
      { proyectoId: state.sel.proyectoId, subcategoriaId: state.sel.subcategoriaId, horas: state.horas },
      [...multiDias]
    );
    if (exito) onCerrar();
  }

  async function solicitarAusencia() {
    if (!state.sel.tipoAusencia || !rangoAus.inicio) return;
    const exito = await ctx.solicitarAusencia(state.sel.tipoAusencia, rangoAus.inicio, rangoAus.fin ?? rangoAus.inicio);
    if (exito) onCerrar();
  }

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={TITULO[state.actual]}
      crumbs={crumbs || `Nueva imputación · ${Number(ctx.selDay.slice(-2))} de mes`}
      onVolver={state.pila.length > 0 ? () => dispatch({ tipo: 'RETROCEDER' }) : undefined}
    >
      {state.actual === 'tipo' && (
        <div className="space-y-2">
          <button type="button" className="opt w-full rounded-2xl border border-border p-4 text-left" onClick={() => dispatch({ tipo: 'AVANZAR', paso: 'proyecto' })}>
            <b className="text-sm">Proyecto</b>
          </button>
          <button type="button" className="opt w-full rounded-2xl border border-border p-4 text-left" onClick={() => dispatch({ tipo: 'AVANZAR', paso: 'austipo' })}>
            <b className="text-sm">Vacaciones / Ausencias</b>
          </button>
        </div>
      )}

      {state.actual === 'proyecto' && (
        <div className="space-y-2">
          {ctx.proyectos.map((p) => (
            <button
              key={p.id}
              type="button"
              className="opt w-full rounded-2xl border border-border p-4 text-left"
              onClick={() => dispatch({ tipo: 'AVANZAR', paso: 'tarea', sel: { proyectoId: p.id, proyectoNombre: p.nombre, empresaNombre: p.empresaNombre } })}
            >
              <b className="text-sm">{p.nombre}</b>
              <span className="block text-xs text-ink-tertiary">{p.empresaNombre}</span>
            </button>
          ))}
        </div>
      )}

      {state.actual === 'tarea' && (
        <div className="space-y-4">
          {ctx.grupos.map((g) => (
            <div key={g.categoriaId}>
              <p className="micro mb-2 flex items-center gap-2">
                <CatDot categoria={g.categoriaNombre} /> {g.categoriaNombre}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {g.subcategorias.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="opt rounded-2xl border border-border p-3 text-left text-sm"
                    onClick={() =>
                      dispatch({
                        tipo: 'AVANZAR',
                        paso: 'horas',
                        sel: { categoriaNombre: g.categoriaNombre, subcategoriaId: s.id, subcategoriaNombre: s.nombre },
                      })
                    }
                  >
                    {s.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {state.actual === 'horas' && (
        <div className="space-y-4">
          <div className="flex justify-center py-4">
            <Stepper value={state.horas} max={ctx.maxHorasDia ?? 12} size="md" onChange={(h) => dispatch({ tipo: 'SET_HORAS', horas: h })} />
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 4, 7].map((q) => (
              <button key={q} type="button" className="btn btn-sm" onClick={() => dispatch({ tipo: 'SET_HORAS', horas: q })}>
                {q}h
              </button>
            ))}
          </div>
          {!destinoStaged && (
            <div>
              <button type="button" className="btn btn-sm w-full justify-center" onClick={() => setMostrarCalMulti((v) => !v)}>
                Aplicar a: {[...multiDias].sort().map((f) => Number(f.slice(-2))).join(', ')}
              </button>
              {mostrarCalMulti && (
                <div className="mt-3">
                  <CalendarGrid
                    dias={ctx.dias}
                    estadoDia={() => 'no-laborable'}
                    claseExtra={(d) => (multiDias.has(d.fecha) ? 'bg-accent text-on-accent border-accent' : '')}
                    onClickDia={toggleDiaMulti}
                  />
                </div>
              )}
            </div>
          )}
          <button type="button" className="btn btn-primary w-full justify-center" onClick={guardarHoras}>
            {destinoStaged ? 'Añadir al precargado' : 'Guardar horas'}
          </button>
        </div>
      )}

      {state.actual === 'austipo' && (
        <div className="space-y-2">
          {TIPOS_AUSENCIA.map((t) => (
            <button
              key={t.valor}
              type="button"
              className="opt w-full rounded-2xl border border-border p-4 text-left"
              onClick={() => dispatch({ tipo: 'AVANZAR', paso: 'ausdias', sel: { tipoAusencia: t.valor, tipoAusenciaEtiqueta: t.etiqueta } })}
            >
              <b className="text-sm">{t.etiqueta}</b>
            </button>
          ))}
        </div>
      )}

      {state.actual === 'ausdias' && (
        <div className="space-y-4">
          <SelectorRangoFechas dias={ctx.dias} rango={rangoAus} onChange={setRangoAus} />
          <p className="micro">La solicitud queda pendiente de aprobación.</p>
          <button type="button" className="btn btn-primary w-full justify-center" onClick={solicitarAusencia} disabled={!rangoAus.inicio}>
            Solicitar ausencia
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
