import type { EmpleadoCtx } from '../types';

/** Placeholder — el layout de escritorio completo se construye en el Paso 3 (empleado_web.html). */
export function ShellEscritorio(_ctx: EmpleadoCtx) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-8">
      <div className="card max-w-sm">
        <div className="card-body text-center text-sm text-ink-secondary">
          El layout de escritorio se está construyendo (Paso 3). Reduce la ventana o entra desde el móvil mientras tanto.
        </div>
      </div>
    </main>
  );
}
