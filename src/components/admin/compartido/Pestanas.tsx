'use client';

import { useRef } from 'react';

interface Props<T extends string> {
  pestanas: { id: T; etiqueta: string }[];
  activa: T;
  onCambiar: (id: T) => void;
  ariaLabel: string;
  /** Prefijo de los ids (`<prefijo>-tab-<id>` / `<prefijo>-panel-<id>`): el contenido usa `idPanel`. */
  prefijo: string;
}

/** Ids que debe llevar el contenedor de cada pestaña para quedar enlazado con su `role="tab"`. */
export function propsPanelPestana(prefijo: string, id: string) {
  return { role: 'tabpanel' as const, id: `${prefijo}-panel-${id}`, 'aria-labelledby': `${prefijo}-tab-${id}`, tabIndex: 0 };
}

/**
 * Pestañas del panel (WAI-ARIA tabs): la pestaña activa la decide quien llama (aquí, un parámetro de la URL: F5 y «atrás» la
 * conservan). Teclado: ← → cambian de pestaña (con vuelta), Inicio/Fin saltan a la primera/última; solo la activa entra en el
 * orden de tabulación (roving tabindex).
 */
export function Pestanas<T extends string>({ pestanas, activa, onCambiar, ariaLabel, prefijo }: Props<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent, indice: number) {
    let destino = -1;
    if (e.key === 'ArrowRight') destino = (indice + 1) % pestanas.length;
    else if (e.key === 'ArrowLeft') destino = (indice - 1 + pestanas.length) % pestanas.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = pestanas.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    const id = pestanas[destino].id;
    onCambiar(id);
    refs.current[id]?.focus();
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 border-b border-border">
      {pestanas.map((p, i) => {
        const seleccionada = p.id === activa;
        return (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[p.id] = el;
            }}
            type="button"
            role="tab"
            id={`${prefijo}-tab-${p.id}`}
            aria-selected={seleccionada}
            aria-controls={`${prefijo}-panel-${p.id}`}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => onCambiar(p.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-extrabold ${
              seleccionada ? 'border-ink-primary text-ink-primary' : 'border-transparent text-ink-tertiary hover:text-ink-primary'
            }`}
          >
            {p.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
