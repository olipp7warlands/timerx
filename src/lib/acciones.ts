/**
 * Única forma de llamar a una server action desde un botón: SIEMPRE resuelve, nunca lanza.
 *
 * Una server action puede fallar «por fuera» del `{ error }` que devuelve (corte de red, 5xx, proxy durante un despliegue, timeout):
 * la promesa se RECHAZA. Sin captura, el `await` aborta el manejador antes de `setCargando(false)` y el botón se queda colgado
 * («Restableciendo…») sin modal ni aviso (v1.6.1: reproducido con la red cortada y con un 500). Con este helper el fallo llega al
 * llamador con la misma forma que un error normal de la acción y recorre su camino de siempre (toast + loading a false).
 *
 * `fallo` construye el resultado de error con la forma de retorno de la acción (p. ej. `(error) => ({ error, password: null })`).
 */
export const ERROR_ACCION =
  'No se pudo completar la acción (error de conexión o del servidor). Comprueba si se aplicó y vuelve a intentarlo.';

export async function llamarAccion<T>(accion: () => Promise<T>, fallo: (error: string) => T): Promise<T> {
  try {
    return await accion();
  } catch (e) {
    console.error('Server action fallida:', e);
    return fallo(ERROR_ACCION);
  }
}
