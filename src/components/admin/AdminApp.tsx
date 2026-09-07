'use client';

import { useState } from 'react';
import { ToastProvider } from '@/components/empleado/compartido/Toast';
import { ShellEscritorioAdmin } from './escritorio/ShellEscritorioAdmin';
import type { AdminInfo, SeccionAdmin } from './types';

export function AdminApp(info: AdminInfo) {
  const [seccion, setSeccion] = useState<SeccionAdmin>('inicio');

  return (
    <ToastProvider>
      <ShellEscritorioAdmin info={info} seccion={seccion} setSeccion={setSeccion} />
    </ToastProvider>
  );
}
