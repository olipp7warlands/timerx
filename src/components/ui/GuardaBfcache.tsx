'use client';

import { useEffect } from 'react';

/**
 * Tras un logout (navegación dura a /login), "atrás" hace que el navegador
 * RESTAURE desde la bfcache la pantalla del usuario anterior tal como estaba
 * (datos y menú abiertos incluidos) sin pasar por el servidor. Si una página
 * vuelve de la bfcache se oculta al instante y se recarga: el servidor decide
 * (sin sesión -> /login?next=..., otra sesión -> sus propios datos).
 */
export function GuardaBfcache() {
  useEffect(() => {
    function alMostrar(e: PageTransitionEvent) {
      if (!e.persisted) return;
      document.documentElement.style.visibility = 'hidden';
      window.location.reload();
    }
    window.addEventListener('pageshow', alMostrar);
    return () => window.removeEventListener('pageshow', alMostrar);
  }, []);
  return null;
}
