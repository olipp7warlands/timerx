/**
 * Color de cada elemento de un rosco (proyectos o empresas) según su TIPOLOGÍA (área del Mapa del grupo, 020).
 * Función única compartida por todos los roscos del panel; réplica de `colorProyecto` del mock.
 *
 * - Base = color del área de la tipología del elemento.
 * - Los siguientes elementos de la MISMA área dentro del MISMO rosco degradan el tono de forma determinista
 *   (`color-mix` hacia `--bg-surface` según su posición dentro del área): funciona igual en tema claro y oscuro.
 *   El mock resta 22 puntos por posición; se fija un suelo (34 %) para que un área con muchos elementos no
 *   acabe indistinguible del fondo ni con porcentajes negativos.
 * - Sin tipología (o con un área que ya no está activa) → los grises del mock, alternando por posición en el rosco.
 *
 * El color NUNCA es el único portador de significado: las leyendas llevan siempre nombre + porcentaje (daltonismo).
 */
const GRISES_SIN_TIPOLOGIA = ['var(--ink-disabled)', 'var(--border-strong)'];
const PASO_DEGRADADO = 22;
const SUELO_DEGRADADO = 34;

export function coloresRosco(areaIds: (string | null)[], colorDeArea: Record<string, string>): string[] {
  const usadosPorArea = new Map<string, number>();
  return areaIds.map((areaId, posicion) => {
    const base = areaId ? colorDeArea[areaId] : undefined;
    if (!areaId || !base) return GRISES_SIN_TIPOLOGIA[posicion % 2];
    const indiceEnArea = usadosPorArea.get(areaId) ?? 0;
    usadosPorArea.set(areaId, indiceEnArea + 1);
    if (indiceEnArea === 0) return base;
    return `color-mix(in srgb, ${base} ${Math.max(100 - indiceEnArea * PASO_DEGRADADO, SUELO_DEGRADADO)}%, var(--bg-surface))`;
  });
}
