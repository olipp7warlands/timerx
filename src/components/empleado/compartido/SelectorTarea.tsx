'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { buscarTarea, type GrupoTareas } from '@/lib/horas/tareas';
import { CatDot } from './CatDot';

interface Props {
  /** Especialidades que la persona puede imputar, agrupadas por departamento (regla única de `repartirTareas`). */
  grupos: GrupoTareas[];
  /** `subcategoria.id` elegida ('' = ninguna). */
  value: string;
  onChange: (subcategoriaId: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}

type Item = { id: string; nombre: string; categoriaNombre: string };

const aItems = (gs: GrupoTareas[]): Item[] => gs.flatMap((g) => g.subcategorias.map((s) => ({ id: s.id, nombre: s.nombre, categoriaNombre: g.categoriaNombre })));

/**
 * Picker de ESPECIALIDAD del escritorio (sustituye al `<select>` nativo): misma presentación que la hoja móvil de «¿Qué especialidad?»
 * —cabeceras de departamento con su punto de color— en un popover anclado al campo. Desde v2.0 no hay «Otras tareas…»: lo que se
 * ofrece lo decide la empresa (y, si el admin lo fija, el conjunto de departamentos de la persona); el cruce raro lo pide a su admin.
 * Accesible como «select-only combobox» (WAI-ARIA APG): el foco se queda en el botón, las opciones se recorren con
 * `aria-activedescendant` (↑ ↓ Inicio Fin, Enter/Espacio elige, Esc cierra, Tab sale).
 * La hoja móvil es la referencia visual: el select nativo del mock web queda sustituido (divergencia documentada en PLAN.md).
 */
export function SelectorTarea({ grupos, value, onChange, ariaLabel = 'Especialidad', placeholder = 'Selecciona especialidad', disabled = false }: Props) {
  const uid = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const [altoMax, setAltoMax] = useState(320);

  const items = useMemo<Item[]>(() => aItems(grupos), [grupos]);
  const idItem = (it: Item) => `${uid}-${it.id}`;
  const elegida = value ? buscarTarea(grupos, value) : null;

  function abrir() {
    if (disabled) return;
    const i = items.findIndex((it) => it.id === value);
    setActivo(i >= 0 ? i : 0);
    const r = raiz.current?.getBoundingClientRect();
    if (r) {
      const abajo = window.innerHeight - r.bottom;
      const arriba = abajo < 320 && r.top > abajo;
      setHaciaArriba(arriba);
      // El popover nunca sobrepasa la ventana: cabe en el hueco del lado elegido (mínimo 160 px, con scroll interno).
      setAltoMax(Math.max(160, Math.min(320, (arriba ? r.top : abajo) - 12)));
    }
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  function elegir(it: Item) {
    onChange(it.id);
    cerrar();
  }

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) cerrar();
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const it = items[activo];
    if (it) document.getElementById(idItem(it))?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo, items]); // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: React.KeyboardEvent) {
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActivo((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActivo((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActivo(0);
        break;
      case 'End':
        e.preventDefault();
        setActivo(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (items[activo]) elegir(items[activo]);
        break;
      case 'Escape':
        e.preventDefault();
        cerrar();
        break;
      case 'Tab':
        cerrar();
        break;
    }
  }

  const idLista = `${uid}-lista`;
  const opcion = (it: Item) => {
    const i = items.indexOf(it);
    const seleccionada = it.id === value;
    return (
      <div
        key={it.id}
        id={idItem(it)}
        role="option"
        aria-selected={seleccionada}
        data-activo={i === activo}
        onMouseEnter={() => setActivo(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => elegir(it)}
        className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-bold ${i === activo ? 'bg-subtle' : ''} ${seleccionada ? 'text-ink-primary' : 'text-ink-secondary'}`}
      >
        {seleccionada && <span aria-hidden="true">✓ </span>}
        {it.nombre}
      </div>
    );
  };
  const bloque = (gs: GrupoTareas[]) =>
    gs.map((g) => {
      const idCab = `${uid}-cab-${g.categoriaId}`;
      return (
        <div key={g.categoriaId} role="group" aria-labelledby={idCab} className="py-1">
          <p id={idCab} className="micro flex items-center gap-2 px-3 pb-1 pt-1.5">
            <CatDot categoria={g.categoriaNombre} /> {g.categoriaNombre}
          </p>
          {g.subcategorias.map((s) => opcion(items.find((it) => it.id === s.id) as Item))}
        </div>
      );
    });

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={abierto && items[activo] ? idItem(items[activo]) : undefined}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={onKeyDown}
        className="input flex w-full items-center gap-2 text-left disabled:opacity-60"
      >
        {elegida ? (
          <>
            <CatDot categoria={elegida.categoriaNombre} />
            <span className="min-w-0 flex-1 truncate">{elegida.nombre}</span>
            <span className="micro shrink-0">{elegida.categoriaNombre}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-disabled">{placeholder}</span>
        )}
        <span aria-hidden="true" className="shrink-0 text-ink-tertiary">
          ▾
        </span>
      </button>

      {abierto && (
        <div
          ref={lista}
          id={idLista}
          role="listbox"
          aria-label={ariaLabel}
          style={{ maxHeight: altoMax }}
          className={`card absolute left-0 z-50 w-full min-w-[260px] overflow-y-auto p-1 shadow-[var(--sombra)] ${haciaArriba ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {grupos.length === 0 && <p className="px-3 py-2 text-xs text-ink-tertiary">No hay especialidades disponibles.</p>}
          {bloque(grupos)}
        </div>
      )}
    </div>
  );
}
