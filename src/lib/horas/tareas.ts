/**
 * Punto ÚNICO de filtrado del catálogo de tareas (categoría › subcategoría) que se ofrece al imputar. Lo usan los cuatro
 * puntos de imputación: composer de escritorio, precargado (lote), wizard móvil y la imputación directa del admin (que
 * filtra por la persona DESTINO). No hay copias: si la regla cambia, cambia aquí.
 *
 * Regla (v1.3):
 *  - Persona CON categoría: por defecto ve las tareas de SU categoría + las transversales (categorías globales, sin
 *    departamento). El resto del catálogo sigue disponible tras «Otras tareas…» (`otras`): el trabajo cruzado existe y se
 *    imputa exactamente igual, sin fricción ni marca.
 *  - Persona SIN categoría: filtro por departamento de siempre (015/026): globales + las de su departamento, o todo si tampoco
 *    tiene departamento. Sin «Otras tareas…» (`otras` vacío): comportamiento sin cambios.
 */

export interface GrupoTareas {
  categoriaId: string;
  categoriaNombre: string;
  subcategorias: { id: string; nombre: string }[];
}

/** Categoría del catálogo con lo mínimo que necesita el reparto (los hooks de empleado y de admin la construyen cada uno a su manera). */
export interface CategoriaCatalogo extends GrupoTareas {
  /** null = global/transversal. */
  departamentoId: string | null;
}

export interface PerfilTareas {
  categoriaId?: string | null;
  departamentoId?: string | null;
}

const porNombre = (a: GrupoTareas, b: GrupoTareas) => a.categoriaNombre.localeCompare(b.categoriaNombre);

export function repartirTareas(catalogo: CategoriaCatalogo[], perfil: PerfilTareas = {}): { grupos: GrupoTareas[]; otras: GrupoTareas[] } {
  const conTareas = catalogo.filter((c) => c.subcategorias.length > 0);
  const limpia = (c: CategoriaCatalogo): GrupoTareas => ({ categoriaId: c.categoriaId, categoriaNombre: c.categoriaNombre, subcategorias: c.subcategorias });

  if (perfil.categoriaId) {
    const propias = (c: CategoriaCatalogo) => c.categoriaId === perfil.categoriaId || c.departamentoId === null;
    return {
      grupos: conTareas.filter(propias).map(limpia).sort(porNombre),
      otras: conTareas.filter((c) => !propias(c)).map(limpia).sort(porNombre),
    };
  }

  const visibles = perfil.departamentoId ? conTareas.filter((c) => c.departamentoId === null || c.departamentoId === perfil.departamentoId) : conTareas;
  return { grupos: visibles.map(limpia).sort(porNombre), otras: [] };
}

/** Busca una subcategoría en los dos bloques (principal y «otras»): sirve para resolver etiquetas y validar la selección vigente. */
export function buscarTarea(grupos: GrupoTareas[], otras: GrupoTareas[], subcategoriaId: string): { categoriaNombre: string; nombre: string } | null {
  for (const g of [...grupos, ...otras]) {
    const s = g.subcategorias.find((x) => x.id === subcategoriaId);
    if (s) return { categoriaNombre: g.categoriaNombre, nombre: s.nombre };
  }
  return null;
}
