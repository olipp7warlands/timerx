/**
 * Punto ÚNICO de filtrado del catálogo de especialidades que se ofrece al imputar (v2.0). Lo usan los cuatro puntos de imputación:
 * composer de escritorio, precargado (lote), wizard móvil y la imputación directa del admin (que filtra por la persona DESTINO).
 * No hay copias: si la regla cambia, cambia aquí.
 *
 * Modelo (v2.0): Departamento → Especialidad. La especialidad es la antigua `subcategoria`; su departamento es el de su categoría
 * ESPEJO (`categoria.departamento_id`, 1:1). Nombres internos `categoria*` = departamento (superviviente del esquema).
 *
 * Regla — una persona puede imputar las especialidades de:
 *  · el conjunto EXACTO de departamentos que su admin le haya fijado (`perfil_departamento`; acota O amplía), o
 *  · si no tiene ninguno, TODOS los departamentos de su empresa (`empresa_departamento`).
 * Sustituye al filtro por categoría del profesional (v1.3, con «Otras tareas…») y al filtro por departamento de 015/026.
 */

/** Un departamento con las especialidades que se pueden elegir dentro de él. (`categoria*` = departamento: el espejo.) */
export interface GrupoTareas {
  categoriaId: string;
  categoriaNombre: string;
  subcategorias: { id: string; nombre: string }[];
}

/** Departamento del catálogo con lo mínimo que necesita el reparto. */
export interface CategoriaCatalogo extends GrupoTareas {
  departamentoId: string;
}

const porNombre = (a: GrupoTareas, b: GrupoTareas) => a.categoriaNombre.localeCompare(b.categoriaNombre);

/** Departamentos visibles de una persona: el conjunto exacto fijado por el admin o, si no hay, los de su empresa. */
export function departamentosVisibles(deLaEmpresa: string[], fijados: string[]): Set<string> {
  return new Set(fijados.length > 0 ? fijados : deLaEmpresa);
}

/**
 * Catálogo → grupos que se ofrecen. `visibles = null` = sin filtro (solo la página de depuración, que no tiene persona).
 * `propio` = departamento de la persona: su grupo va PRIMERO (lo que se preselecciona al imputar), el resto por nombre.
 */
export function repartirTareas(catalogo: CategoriaCatalogo[], visibles: ReadonlySet<string> | null, propio: string | null = null): GrupoTareas[] {
  return catalogo
    .filter((c) => c.subcategorias.length > 0 && (visibles === null || visibles.has(c.departamentoId)))
    .sort((a, b) => Number(b.departamentoId === propio) - Number(a.departamentoId === propio) || porNombre(a, b))
    .map((c): GrupoTareas => ({ categoriaId: c.categoriaId, categoriaNombre: c.categoriaNombre, subcategorias: c.subcategorias }));
}

/** Busca una especialidad en los grupos que se ofrecen: sirve para resolver etiquetas y validar la selección vigente. */
export function buscarTarea(grupos: GrupoTareas[], subcategoriaId: string): { categoriaNombre: string; nombre: string } | null {
  for (const g of grupos) {
    const s = g.subcategorias.find((x) => x.id === subcategoriaId);
    if (s) return { categoriaNombre: g.categoriaNombre, nombre: s.nombre };
  }
  return null;
}
