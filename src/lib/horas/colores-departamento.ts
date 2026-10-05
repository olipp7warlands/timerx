/**
 * Color de un DEPARTAMENTO (v2.0): `departamento.color` guarda una CLAVE de paleta, no un hex (mismo principio que el mapa del grupo): los
 * valores claro/oscuro viven en `globals.css` (`--dep-<clave>`), así que contraste y tema los controla la app y no el dato.
 * Los cuatro tonos históricos (azul, arena, malva, verde) conservan EXACTAMENTE los valores de los antiguos grupos de color
 * Desarrollo / Diseño / Abogados / Gestión. El color NUNCA es el único portador de significado: siempre va junto al nombre.
 */
export const CLAVES_COLOR = ['azul', 'arena', 'malva', 'verde', 'turquesa', 'rosa', 'oliva', 'indigo', 'terracota', 'ocre', 'pizarra', 'granate'] as const;
export type ClaveColor = (typeof CLAVES_COLOR)[number];

export const ETIQUETA_COLOR: Record<ClaveColor, string> = {
  azul: 'Azul',
  arena: 'Arena',
  malva: 'Malva',
  verde: 'Verde',
  turquesa: 'Turquesa',
  rosa: 'Rosa',
  oliva: 'Oliva',
  indigo: 'Índigo',
  terracota: 'Terracota',
  ocre: 'Ocre',
  pizarra: 'Pizarra',
  granate: 'Granate',
};

/** `var(--dep-azul)`… o un gris neutro si no hay clave (departamento sin color) o es desconocida. */
export function colorDeClave(clave: string | null | undefined): string {
  return clave && (CLAVES_COLOR as readonly string[]).includes(clave) ? `var(--dep-${clave})` : 'var(--ink-tertiary)';
}

/** Primera clave de la paleta que no usa ningún departamento; si se agotan, la menos usada. */
export function siguienteColorLibre(usados: (string | null)[]): ClaveColor {
  const cuenta = new Map<string, number>(CLAVES_COLOR.map((c) => [c, 0]));
  for (const u of usados) if (u && cuenta.has(u)) cuenta.set(u, (cuenta.get(u) ?? 0) + 1);
  return [...CLAVES_COLOR].sort((a, b) => (cuenta.get(a) ?? 0) - (cuenta.get(b) ?? 0))[0];
}
