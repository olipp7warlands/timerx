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
