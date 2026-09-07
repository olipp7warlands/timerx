'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Modo = 'password' | 'enlace';

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function entrarConPassword(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setEstado('error');
      return;
    }

    router.push('/');
    router.refresh();
  }

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

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setEstado('idle');
    setError(null);
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
          ) : modo === 'password' ? (
            <form onSubmit={entrarConPassword} className="flex flex-col gap-3">
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
              <label htmlFor="password" className="micro">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary mt-2 w-full justify-center"
                disabled={estado === 'enviando'}
              >
                {estado === 'enviando' ? 'Entrando…' : 'Entrar'}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" className="btn-text self-center" onClick={() => cambiarModo('enlace')}>
                Prefiero un enlace por email
              </button>
            </form>
          ) : (
            <form onSubmit={enviarEnlace} className="flex flex-col gap-3">
              <label htmlFor="email-enlace" className="micro">
                Correo electrónico
              </label>
              <input
                id="email-enlace"
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
              <button type="button" className="btn-text self-center" onClick={() => cambiarModo('password')}>
                Prefiero usuario y contraseña
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
