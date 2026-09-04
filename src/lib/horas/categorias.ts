const COLOR_POR_NOMBRE: Record<string, string> = {
  Desarrollo: 'var(--cat-desarrollo)',
  Diseño: 'var(--cat-diseno)',
  Abogados: 'var(--cat-abogados)',
  Gestión: 'var(--cat-gestion)',
};

/** Los 4 colores de categoría son fijos por diseño (PLAN.md sección 3); fallback neutro si aparece otra. */
export function colorCategoria(nombre: string): string {
  return COLOR_POR_NOMBRE[nombre] ?? 'var(--ink-tertiary)';
}
