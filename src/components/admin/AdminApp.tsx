'use client';

import { useState } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { ToastProvider } from '@/components/empleado/compartido/Toast';
import { ShellEscritorioAdmin } from './escritorio/ShellEscritorioAdmin';
import { ShellMovilAdmin } from './movil/ShellMovilAdmin';
import type { AdminInfo, SeccionAdmin } from './types';

interface Props extends AdminInfo {
  /** Solo para verificación visual (/debug/movil-admin): fuerza el layout sin depender del viewport real. */
  forzarLayout?: 'movil' | 'escritorio';
}

function AdminAppInterno({ forzarLayout, ...info }: Props) {
  const isDesktopReal = useIsDesktop();
  const isDesktop = forzarLayout ? forzarLayout === 'escritorio' : isDesktopReal;
  const [seccion, setSeccion] = useState<SeccionAdmin>('inicio');

  if (isDesktop === null) {
    // Mismo markup en servidor y primer paint de cliente: sin mismatch de hidratación.
    return <div className="min-h-screen bg-bg" />;
  }

  return isDesktop ? (
    <ShellEscritorioAdmin info={info} seccion={seccion} setSeccion={setSeccion} />
  ) : (
    <ShellMovilAdmin info={info} seccion={seccion} setSeccion={setSeccion} />
  );
}

export function AdminApp(props: Props) {
  return (
    <ToastProvider>
      <AdminAppInterno {...props} />
    </ToastProvider>
  );
}
