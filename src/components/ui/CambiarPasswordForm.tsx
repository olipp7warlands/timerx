'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/empleado/compartido/Toast';

interface Props {
  email: string;
  onExito: () => void;
}

/** "Invalid login credentials" (contraseña actual incorrecta) -> mensaje accionable. */
function mensajeErrorActual(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return 'Contraseña actual incorrecta.';
  return mensaje;
}

export function CambiarPasswordForm({ email, onExito }: Props) {
  const toast = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nueva !== confirmar) {
      toast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }
    if (nueva.length < 6) {
      toast('La contraseña nueva debe tener al menos 6 caracteres', 'error');
      return;
    }

    setEnviando(true);
    const supabase = createClient();

    // Supabase no comprueba la contraseña actual al hacer updateUser(): la
    // verificamos primero con un login real, para no permitir un cambio con
    // sesión robada sin saber la contraseña vigente.
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email, password: actual });
    if (errorActual) {
      toast(mensajeErrorActual(errorActual.message), 'error');
      setEnviando(false);
      return;
    }

    const { error: errorNueva } = await supabase.auth.updateUser({ password: nueva });
    setEnviando(false);
    if (errorNueva) {
      toast(errorNueva.message, 'error');
      return;
    }

    toast('Contraseña actualizada');
    setActual('');
    setNueva('');
    setConfirmar('');
    onExito();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <label className="micro mb-1 block">Contraseña actual</label>
        <input
          type="password"
          required
          className="input"
          placeholder="••••••••"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      </div>
      <div>
        <label className="micro mb-1 block">Contraseña nueva</label>
        <input
          type="password"
          required
          className="input"
          placeholder="••••••••"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
      </div>
      <div>
        <label className="micro mb-1 block">Repite la contraseña nueva</label>
        <input
          type="password"
          required
          className="input"
          placeholder="••••••••"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary mt-1 w-full justify-center" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
