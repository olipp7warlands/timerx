'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { rutaInternaSegura } from '@/lib/nav/ruta-segura';

type Modo = 'password' | 'enlace' | 'olvido';

/** "Signups not allowed for otp" (shouldCreateUser:false contra un email no dado de alta) -> mensaje accionable. */
function mensajeError(mensaje: string): string {
  if (/user is banned|user_banned/i.test(mensaje)) {
    return 'Cuenta desactivada — habla con tu administrador.';
  }
  if (/signups? not allowed/i.test(mensaje)) {
    return 'Este correo no está dado de alta. Pide acceso a tu administrador.';
  }
  return mensaje;
}

/** Destino tras el login: `?next=` del enlace profundo, validado como ruta interna. Se lee al enviar (no en render): sin Suspense. */
function destinoTrasLogin(): string {
  return rutaInternaSegura(new URLSearchParams(window.location.search).get('next'));
}

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
      setError(mensajeError(error.message));
      setEstado('error');
      return;
    }

    router.replace(destinoTrasLogin());
    router.refresh();
  }

  async function enviarRecuperacion(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(mensajeError(error.message));
      setEstado('error');
      return;
    }

    setEstado('enviado');
  }

  async function enviarEnlace(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinoTrasLogin())}`, shouldCreateUser: false },
    });

    if (error) {
      setError(mensajeError(error.message));
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
              {modo === 'olvido'
                ? <>Si <strong>{email}</strong> tiene una cuenta, te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo.</>
                : <>Te hemos enviado un enlace de acceso a <strong>{email}</strong>. Revisa tu correo.</>}
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
              <button type="button" className="btn-text self-center" onClick={() => cambiarModo('olvido')}>
                ¿Olvidaste tu contraseña?
              </button>
              <button type="button" className="btn-text self-center" onClick={() => cambiarModo('enlace')}>
                Prefiero un enlace por email
              </button>
            </form>
          ) : modo === 'olvido' ? (
            <form onSubmit={enviarRecuperacion} className="flex flex-col gap-3">
              <label htmlFor="email-olvido" className="micro">
                Correo electrónico
              </label>
              <input
                id="email-olvido"
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
                {estado === 'enviando' ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" className="btn-text self-center" onClick={() => cambiarModo('password')}>
                Volver a usuario y contraseña
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
