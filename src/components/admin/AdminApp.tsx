'use client';

import { Suspense } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { ToastProvider } from '@/components/empleado/compartido/Toast';
import { SoporteNovedadProvider } from '@/hooks/useNovedadSoporte';
import { NavAdminProvider } from './NavAdmin';
import { ShellEscritorioAdmin } from './escritorio/ShellEscritorioAdmin';
import { ShellMovilAdmin } from './movil/ShellMovilAdmin';
import type { AdminInfo } from './types';

interface Props extends AdminInfo {
  /** Solo para verificación visual (/debug/movil-admin): fuerza el layout sin depender del viewport real. */
  forzarLayout?: 'movil' | 'escritorio';
}

function AdminAppInterno({ forzarLayout, ...info }: Props) {
  const isDesktopReal = useIsDesktop();
  const isDesktop = forzarLayout ? forzarLayout === 'escritorio' : isDesktopReal;

  if (isDesktop === null) {
    // Mismo markup en servidor y primer paint de cliente: sin mismatch de hidratación.
    return <div className="min-h-screen bg-bg" />;
  }

  return isDesktop ? <ShellEscritorioAdmin info={info} /> : <ShellMovilAdmin info={info} />;
}

export function AdminApp(props: Props) {
  return (
    <ToastProvider>
      {/* useSearchParams (hand-offs efímeros) exige Suspense en cualquier page que pudiera prerenderizarse. */}
      <Suspense fallback={<div className="min-h-screen bg-bg" />}>
        <NavAdminProvider aislado={!!props.forzarLayout}>
          <SoporteNovedadProvider>
            <AdminAppInterno {...props} />
          </SoporteNovedadProvider>
        </NavAdminProvider>
      </Suspense>
    </ToastProvider>
  );
}
