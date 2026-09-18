/**
 * Valida un destino `next` recibido por query (login, callback de auth) como
 * ruta INTERNA. Rechaza esquemas, `//host` y `\` (que algunos navegadores
 * normalizan a `/`): todos son vías de open-redirect.
 */
export function rutaInternaSegura(next: string | null | undefined, porDefecto = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return porDefecto;
  return next;
}
