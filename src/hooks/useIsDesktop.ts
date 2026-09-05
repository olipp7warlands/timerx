'use client';

import { useEffect, useState } from 'react';

const QUERY = '(min-width: 980px)';

/**
 * El servidor no conoce el viewport: arranca en null (ni móvil ni escritorio)
 * y solo se resuelve tras el primer efecto en cliente. El consumidor debe
 * renderizar un skeleton mientras es null — así el primer paint de cliente
 * coincide con el HTML del servidor y no hay mismatch de hidratación ni flash
 * del layout equivocado (frente a renderizar ambos árboles y ocultar uno por
 * CSS, que evita el flash pero monta el doble de estado/efectos).
 */
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
