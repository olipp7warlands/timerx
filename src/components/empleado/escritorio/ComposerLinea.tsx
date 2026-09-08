'use client';

import { useEffect, useState } from 'react';
import { Stepper } from '../compartido/Stepper';
import type { ProyectoAsignado } from '@/hooks/useProyectosAsignados';
import type { GrupoTareas } from '@/hooks/useCategoriasTareas';
import type { StagedLinea } from '../types';

interface ComposerLineaProps {
  proyectos: ProyectoAsignado[];
  grupos: GrupoTareas[];
  maxHorasDia: number | null;
  etiquetaBoton?: string;
  onAnadir: (linea: StagedLinea) => void;
}

/**
 * Selects + stepper + botón "Añadir" — el mismo componente que el mock reutiliza
 * tal cual entre el composer normal de la tabla y el "＋ Añadir al lote" del
 * precargado (mismas opsProy/opsTarea, distinto estado que lo alimenta). Al ser
 * un componente React normal (no remontado por el padre), el valor elegido
 * sobrevive a los re-renders de la tabla/lista sin necesitar el truco del mock
 * de "renderComposer() una sola vez".
 */
export function ComposerLinea({ proyectos, grupos, maxHorasDia, etiquetaBoton = 'Añadir', onAnadir }: ComposerLineaProps) {
  const [proyectoId, setProyectoId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [horas, setHoras] = useState(1);

  useEffect(() => {
    if (!proyectos.some((p) => p.id === proyectoId)) setProyectoId(proyectos[0]?.id ?? '');
  }, [proyectos, proyectoId]);

  useEffect(() => {
    if (!subcategoriaId && grupos[0]?.subcategorias[0]) setSubcategoriaId(grupos[0].subcategorias[0].id);
  }, [grupos, subcategoriaId]);

  function anadir() {
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    let subcategoriaNombre = '';
    let categoriaNombre = '';
    for (const g of grupos) {
      const s = g.subcategorias.find((s) => s.id === subcategoriaId);
      if (s) {
        subcategoriaNombre = s.nombre;
        categoriaNombre = g.categoriaNombre;
        break;
      }
    }
    if (!proyecto || !subcategoriaNombre) return;
    onAnadir({
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      empresaNombre: proyecto.empresaNombre,
      categoriaNombre,
      subcategoriaId,
      subcategoriaNombre,
      horas,
    });
  }

  return (
    <div className="grid grid-cols-2 items-center gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_auto_auto]">
      <select className="input" aria-label="Proyecto" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
        {proyectos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} — {p.empresaNombre}
          </option>
        ))}
      </select>
      <select className="input" aria-label="Tarea" value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)}>
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
      <Stepper value={horas} max={maxHorasDia ?? 12} onChange={setHoras} />
      <button type="button" className="btn btn-primary" onClick={anadir}>
        {etiquetaBoton}
      </button>
    </div>
  );
}
