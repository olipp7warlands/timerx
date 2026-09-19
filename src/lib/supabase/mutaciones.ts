/**
 * Resultado de un `update`/`delete` de PostgREST con `.select(...)`. RLS NO da error cuando la fila queda fuera de ámbito
 * (o ya no existe): da 0 filas, y sin esta comprobación la UI anunciaría un «guardado» falso (hallazgo D, 022/024).
 * Todo update/delete cliente debe pasar por aquí (o comprobar `data.length` con un mensaje propio).
 */
export const SIN_FILAS = 'No se aplicó el cambio: no tienes permiso sobre este registro o ya no existe.';

export function resultadoMutacion(
  error: { message: string } | null,
  data: readonly unknown[] | null | undefined,
  sinFilas: string = SIN_FILAS
): { error: string | null } {
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: sinFilas };
  return { error: null };
}
