'use client';

/**
 * Navegación entre URLs de la MISMA page catch-all. `history.pushState` /
 * `replaceState` están integrados con el router de Next (sincronizan
 * `usePathname`/`useSearchParams` y `popstate` lo gestiona el router), y
 * evitan un viaje al servidor por cada clic de pestaña/sección.
 */
export function navegar(url: string) {
  if (url === window.location.pathname + window.location.search) return;
  window.history.pushState(null, '', url);
  window.scrollTo(0, 0);
}

/** Sustituye la entrada actual (limpieza de hand-offs, ficha inexistente): no añade historial. */
export function reemplazar(url: string) {
  window.history.replaceState(null, '', url);
}
