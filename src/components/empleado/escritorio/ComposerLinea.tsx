'use client';

import { useEffect, useState } from 'react';
import { Stepper } from '../compartido/Stepper';
import { SelectorTarea } from '../compartido/SelectorTarea';
import { buscarTarea } from '@/lib/horas/tareas';
import { useDescripcionObligatoria } from '@/hooks/useDescripcionObligatoria';
import type { ProyectoAsignado } from '@/hooks/useProyectosAsignados';
import type { GrupoTareas } from '@/hooks/useCategoriasTareas';
import type { StagedLinea } from '../types';

interface ComposerLineaProps {
  proyectos: ProyectoAsignado[];
  grupos: GrupoTareas[];
  otras: GrupoTareas[];
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
export function ComposerLinea({ proyectos, grupos, otras, maxHorasDia, etiquetaBoton = 'Añadir', onAnadir }: ComposerLineaProps) {
  const [proyectoId, setProyectoId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [horas, setHoras] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const descripcionObligatoria = useDescripcionObligatoria();

  useEffect(() => {
    if (!proyectos.some((p) => p.id === proyectoId)) setProyectoId(proyectos[0]?.id ?? '');
  }, [proyectos, proyectoId]);

  // Por defecto, la primera tarea de lo que se ofrece (o, si la persona solo tiene «otras», la primera de ellas).
  useEffect(() => {
    if (!subcategoriaId) setSubcategoriaId((grupos[0] ?? otras[0])?.subcategorias[0]?.id ?? '');
  }, [grupos, otras, subcategoriaId]);

  function anadir() {
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    const tarea = buscarTarea(grupos, otras, subcategoriaId);
    const subcategoriaNombre = tarea?.nombre ?? '';
    const categoriaNombre = tarea?.categoriaNombre ?? '';
    if (!proyecto || !subcategoriaNombre) return;
    if (descripcionObligatoria && !descripcion.trim()) return;
    onAnadir({
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      empresaNombre: proyecto.empresaNombre,
      categoriaNombre,
      subcategoriaId,
      subcategoriaNombre,
      horas,
      descripcion,
    });
    setDescripcion('');
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      {descripcionObligatoria && (
        <input
          className="input"
          aria-label="Descripción"
          placeholder="Descripción (obligatoria)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      )}
      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_auto_auto]">
        <select className="input" aria-label="Proyecto" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {p.empresaNombre}
            </option>
          ))}
        </select>
        <SelectorTarea grupos={grupos} otras={otras} value={subcategoriaId} onChange={setSubcategoriaId} ariaLabel="Tarea" />
        <Stepper value={horas} max={maxHorasDia ?? 12} onChange={setHoras} />
        <button type="button" className="btn btn-primary" disabled={descripcionObligatoria && !descripcion.trim()} onClick={anadir}>
          {etiquetaBoton}
        </button>
      </div>
    </div>
  );
}
