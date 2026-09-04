'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function enviarEnlace(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setEstado('error');
      return;
    }

    setEstado('enviado');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-sm">
        <div className="card-head">
          <h2>Horas Grupo</h2>
        </div>
        <div className="card-body">
          {estado === 'enviado' ? (
            <p className="text-sm text-ink-secondary">
              Te hemos enviado un enlace de acceso a <strong>{email}</strong>. Revisa tu correo.
            </p>
          ) : (
            <form onSubmit={enviarEnlace} className="flex flex-col gap-3">
              <label htmlFor="email" className="micro">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary mt-2 w-full justify-center"
                disabled={estado === 'enviando'}
              >
                {estado === 'enviando' ? 'Enviando…' : 'Enviar enlace de acceso'}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
