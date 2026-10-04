'use client';

import { useEffect, useState } from 'react';

/** Build de ESTA pestaña: `next.config.ts` lo fija al construir y queda incrustado en el bundle (el servidor expone el suyo en /api/version). */
const MI_BUILD = process.env.BUILD_FECHA ?? null;
const INTERVALO_MS = 15 * 60 * 1000;
const ESPERA_MINIMA_MS = 60 * 1000;

/**
 * «Hay una versión nueva — recarga». Una pestaña abierta antes de un despliegue sigue ejecutando el JavaScript viejo hasta recargar
 * (v1.6.1: el «Mes» pareció no refrescarse porque la pestaña era anterior al fix). Chequeo barato y sin tiempo real: al volver a la
 * pestaña y cada 15 min, con un mínimo de 1 min entre peticiones. Si el build del servidor difiere del de la pestaña, aparece un
 * aviso discreto con la acción de recargar. Sin build conocido (desarrollo) no hace nada.
 */
export function BannerVersion() {
  const [hayNueva, setHayNueva] = useState(false);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    if (!MI_BUILD || process.env.NODE_ENV !== 'production') return;
    let vivo = true;
    let ultimo = 0;
    async function comprobar() {
      const ahora = Date.now();
      if (ahora - ultimo < ESPERA_MINIMA_MS) return;
      ultimo = ahora;
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const j = (await r.json()) as { build?: string | null };
        if (vivo && j.build && j.build !== MI_BUILD) setHayNueva(true);
      } catch {
        // Sin red o servidor reiniciando: se reintenta en el siguiente chequeo.
      }
    }
    const alVolver = () => {
      if (document.visibilityState === 'visible') void comprobar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    const t = setInterval(() => void comprobar(), INTERVALO_MS);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      clearInterval(t);
    };
  }, []);

  if (!hayNueva || descartado) return null;
  return (
    <div
      role="status"
      data-testid="banner-version"
      className="fixed left-1/2 top-3 z-[60] flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 text-xs font-extrabold shadow-lg"
    >
      <span>Hay una versión nueva — recarga</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
        Recargar
      </button>
      <button type="button" aria-label="Descartar aviso" className="text-ink-tertiary" onClick={() => setDescartado(true)}>
        ✕
      </button>
    </div>
  );
}
