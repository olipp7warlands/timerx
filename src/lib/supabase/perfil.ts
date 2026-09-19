import { createClient } from './server';

/**
 * Perfil de la sesión SOLO si la cuenta está activa (acciones de servidor y rutas API). `activo = false` (baja lógica desde la ficha)
 * bloquea el uso de la aplicación: las páginas muestran «Cuenta desactivada» (`CuentaDesactivada`) y estas rutas responden como sin permisos.
 * Nota: es un bloqueo de APLICACIÓN; no revoca el JWT ni la API de datos (ver PLAN.md, hallazgo I).
 */
export async function getPerfilActivoServer() {
  const perfil = await getPerfilServer();
  return perfil && perfil.activo !== false ? perfil : null;
}

export async function getPerfilServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfil')
    .select('*, empresa(*), departamento:departamento!perfil_departamento_id_fkey(*)')
    .eq('id', user.id)
    .single();

  return perfil;
}

/**
 * ¿La sesión de la petición es de una cuenta DESACTIVADA? Dos señales, según el punto del bloqueo:
 *  - el ban de Auth: `getUser()` falla con `user_banned`;
 *  - el pre-request de la 025 (cuenta desactivada con JWT vigente y sin ban aún): la lectura del propio perfil responde `Cuenta desactivada`.
 * Solo se consulta cuando `getPerfilServer()` no devolvió perfil, para mostrar «Cuenta desactivada» en vez de mandar a /login.
 */
export async function sesionDesactivadaServer(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error?.code === 'user_banned') return true;
  if (!user) return false;
  const { error: errorPerfil } = await supabase.from('perfil').select('id').eq('id', user.id).maybeSingle();
  return errorPerfil?.message === 'Cuenta desactivada';
}
