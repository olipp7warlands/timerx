/**
 * Contraseña temporal legible con el patrón `Palabra-1234`. Única fuente: la usan "Restablecer contraseña"
 * (servidor) y el "Generar" del alta manual (cliente), para que ambas entreguen el mismo tipo de credencial.
 * El azar sale de `crypto` (disponible en el navegador y en Node), no de `Math.random`.
 */
const PALABRAS = ['Roble', 'Nube', 'Rio', 'Monte', 'Brisa', 'Lago', 'Pino', 'Alba', 'Cielo', 'Prado', 'Faro', 'Bosque'];

/** Longitud mínima aceptada para una contraseña inicial escrita a mano (el patrón generado ya la supera). */
export const PASSWORD_MIN = 8;

function entero(maxExclusivo: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusivo;
}

export function generarPasswordTemporal(): string {
  return `${PALABRAS[entero(PALABRAS.length)]}-${1000 + entero(9000)}`;
}
