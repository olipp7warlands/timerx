'use client';

import { cerrarSesion } from './MenuUsuario';

/**
 * Pantalla de una cuenta con `activo = false` (baja lógica): ninguna página de la aplicación monta datos. Cierra sesión con la misma
 * navegación dura de `MenuUsuario` para no dejar estado en memoria.
 */
export function CuentaDesactivada({ nombre }: { nombre?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="card w-full max-w-sm p-6 text-center" data-testid="cuenta-desactivada">
        <h1 className="text-lg font-extrabold">Cuenta desactivada</h1>
        {nombre && <p className="mt-1 text-xs font-semibold text-ink-tertiary">{nombre}</p>}
        <p className="mt-3 text-sm text-ink-secondary">Tu cuenta está desactivada. Habla con tu administrador para que la reactive.</p>
        <div className="mt-5">
          <button type="button" className="btn btn-primary w-full" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}
