import type { SupabaseClient } from '@supabase/supabase-js';

export interface AltaUsuarioInput {
  email: string;
  nombre: string;
  empresaId: string;
  departamentoId?: string | null;
  rol: 'empleado' | 'responsable_proyecto' | 'admin_empresa' | 'admin_grupo';
  categoriaId?: string | null;
  /** Contraseña inicial (solo modo `con-password`). */
  password?: string | null;
}

/**
 * Modo único para el alta manual (`invitarUsuario`) y la masiva (importador), vía `modoAltaDesdeEntorno()`:
 * - `invitar`: invitación real por email (`inviteUserByEmail`). Producción (`MODO_EMAIL=real`).
 * - `con-password`: alta manual con contraseña inicial que el admin entrega en mano (`createUser` con `password`,
 *   sin correo). Es el camino habitual del alta manual desde la decisión "sin email".
 * - `sin-email`: la cuenta nace confirmada y SIN contraseña, sin enviar nada (`createUser`). Demo
 *   (`MODO_EMAIL` distinto de `real`), igual que nacieron las 11 cuentas de demo: los correos de demo (@wowinx.com)
 *   no tienen buzón, así que una invitación rebotaría en silencio y agotaría el límite del SMTP de Supabase.
 *   El acceso llega con "Restablecer contraseña" desde la ficha del usuario.
 */
export type ModoAlta = 'invitar' | 'sin-email' | 'con-password';

export function modoAltaDesdeEntorno(): ModoAlta {
  return process.env.MODO_EMAIL === 'real' ? 'invitar' : 'sin-email';
}

/**
 * Única mutación de alta de usuario (auth + perfil): la usan `invitarUsuario` y el importador.
 * `handle_new_user()` (001) crea el perfil desde `user_metadata`; departamento y categoría se completan después.
 * Si la cuenta de auth llegó a crearse pero falla el resto, devuelve `userId` junto al error: el llamador
 * decide (el importador la revierte).
 */
export async function altaUsuario(
  admin: SupabaseClient,
  input: AltaUsuarioInput,
  modo: ModoAlta
): Promise<{ userId: string | null; error: string | null }> {
  const metadata = { empresa_id: input.empresaId, nombre: input.nombre, rol: input.rol };

  const { data, error } =
    modo === 'invitar'
      ? await admin.auth.admin.inviteUserByEmail(input.email, { data: metadata })
      : await admin.auth.admin.createUser({
          email: input.email,
          email_confirm: true,
          user_metadata: metadata,
          ...(modo === 'con-password' && input.password ? { password: input.password } : {}),
        });
  if (error || !data.user) return { userId: null, error: error?.message ?? 'No se pudo crear la cuenta' };

  if (input.departamentoId || input.categoriaId) {
    const { error: errPerfil } = await admin
      .from('perfil')
      .update({ departamento_id: input.departamentoId ?? null, categoria_id: input.categoriaId ?? null })
      .eq('id', data.user.id);
    if (errPerfil) return { userId: data.user.id, error: `Cuenta creada pero falló completar el perfil: ${errPerfil.message}` };
  }

  return { userId: data.user.id, error: null };
}
