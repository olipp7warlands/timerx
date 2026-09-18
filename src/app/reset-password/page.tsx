'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Estado = 'comprobando' | 'sin_sesion' | 'listo' | 'enviando' | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('comprobando');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEstado(session ? 'listo' : 'sin_sesion');
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setEstado('enviando');
    const supabase = createClient();
    const { error: errorUpdate } = await supabase.auth.updateUser({ password: nueva });
    if (errorUpdate) {
      setError(errorUpdate.message);
      setEstado('listo');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-sm">
        <div className="card-head">
          <h2>Nueva contraseña</h2>
        </div>
        <div className="card-body">
          {estado === 'comprobando' ? (
            <p className="text-sm text-ink-tertiary">Comprobando enlace…</p>
          ) : estado === 'sin_sesion' ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-secondary">Enlace inválido o caducado. Solicita uno nuevo desde el login.</p>
              <a href="/login" className="btn btn-primary w-full justify-center">
                Volver al login
              </a>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label htmlFor="nueva" className="micro">
                Contraseña nueva
              </label>
              <input
                id="nueva"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
              <label htmlFor="confirmar" className="micro">
                Repite la contraseña nueva
              </label>
              <input
                id="confirmar"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
              <button type="submit" className="btn btn-primary mt-2 w-full justify-center" disabled={estado === 'enviando'}>
                {estado === 'enviando' ? 'Guardando…' : 'Guardar contraseña'}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
