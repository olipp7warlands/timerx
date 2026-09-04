'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastState {
  mensaje: string;
  tipo: 'info' | 'error';
}

const ToastContext = createContext<((mensaje: string, tipo?: 'info' | 'error') => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((mensaje: string, tipo: 'info' | 'error' = 'info') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ mensaje, tipo });
    timeoutRef.current = setTimeout(() => setToast(null), tipo === 'error' ? 5000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold shadow-[var(--sombra)] ${
            toast.tipo === 'error' ? 'bg-red-600 text-white' : 'bg-accent text-on-accent'
          }`}
        >
          {toast.mensaje}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Muestra error.message (texto literal del trigger de SQL) tal cual — nunca un mensaje genérico. */
export function useToast() {
  const mostrar = useContext(ToastContext);
  if (!mostrar) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return mostrar;
}
