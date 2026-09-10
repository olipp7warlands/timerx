'use client';

import { useState } from 'react';
import type { AreaMapa } from '@/hooks/useMapa';
import { IconMapa } from '@/components/ui/icons';

interface Props {
  areas: AreaMapa[];
  variante: 'grid' | 'stack';
}

/** Render de solo lectura del Mapa del grupo, compartido por las 4 superficies (idéntico al mock: acordeón independiente por elemento, sin "cerrar los demás"). */
export function MapaGrid({ areas, variante }: Props) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (areas.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-tertiary">
        <IconMapa />
        Todavía no hay áreas en el mapa.
      </p>
    );
  }

  return (
    <div className={variante === 'grid' ? 'mapa-grid' : 'mapa-grid-stack'}>
      {areas.map((area) => (
        <div key={area.id} className="mapa-card">
          <div className="mapa-head" style={{ background: area.color }}>
            <span className="m-dot" />
            {area.nombre}
          </div>
          {area.items.map((item) => {
            const abierto = abiertos.has(item.id);
            return (
              <div key={item.id}>
                <button type="button" className={`mapa-item ${abierto ? 'open' : ''}`} aria-expanded={abierto} onClick={() => toggle(item.id)}>
                  {item.etiqueta && <span className="mapa-tag">{item.etiqueta}</span>}
                  {item.nombre}
                  <span className="chev">›</span>
                </button>
                <div className={`mapa-det ${abierto ? 'on' : ''}`}>
                  {item.descripcion}
                  {item.empresaNombre && <span className="m-emp">{item.empresaNombre}</span>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="m-url" onClick={(e) => e.stopPropagation()}>
                      {item.url}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
