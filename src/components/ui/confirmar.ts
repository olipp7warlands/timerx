/** Punto único de confirmación destructiva -- hoy window.confirm, sustituible por un diálogo propio sin tocar cada caller. */
export function confirmar(mensaje: string): boolean {
  return window.confirm(mensaje);
}
