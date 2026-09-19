'use server';

import { hoyMadrid, sumarDias } from '@/lib/fechas';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { getPerfilActivoServer as getPerfilServer } from '@/lib/supabase/perfil';
import { procesarRecordatorios } from '@/lib/recordatorios/enviar';
import { altaUsuario, modoAltaDesdeEntorno, type AltaUsuarioInput, type ModoAlta } from '@/lib/usuarios/alta';
import { generarPasswordTemporal, PASSWORD_MIN } from '@/lib/usuarios/password';
import { errorAlta, errorRestablecer } from '@/lib/usuarios/permisos';
import type { RolUsuario } from '@/lib/auth/roles';

const VENTANA_DIAS_RECORDATORIO = 5;

export type InvitarUsuarioInput = AltaUsuarioInput;

/**
 * Alta manual de UN usuario vía Admin API (service_role) -- solo puede correr en servidor. Misma operación que el
 * importador (`altaUsuario`). Con `password` (decisión "sin email"): la cuenta nace confirmada y con esa contraseña
 * inicial, que el admin entrega en mano. Sin `password`: comportamiento por `MODO_EMAIL` (dormido salvo `real`).
 * Devuelve `modo` para que la UI diga la verdad sobre lo que ha pasado.
 * handle_new_user() (023) crea el perfil con empresa/nombre de user_metadata y rol 'empleado'; `altaUsuario` asigna el rol después.
 * Permisos replicados aquí (service_role salta RLS y la guarda de la 021): ver `errorAlta` en `lib/usuarios/permisos.ts`
 * -- un admin_empresa solo da de alta empleados/responsables de SU empresa; los roles admin_* exigen admin_grupo.
 */
export async function invitarUsuario(input: InvitarUsuarioInput): Promise<{ error: string | null; modo?: ModoAlta }> {
  const perfil = await getPerfilServer();
  if (!perfil) return { error: 'Sin permisos para invitar usuarios' };
  const errorPermisos = errorAlta(perfil, input);
  if (errorPermisos) return { error: errorPermisos };
  if (input.password && input.password.length < PASSWORD_MIN) {
    return { error: `La contraseña inicial debe tener al menos ${PASSWORD_MIN} caracteres` };
  }

  const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const modo: ModoAlta = input.password ? 'con-password' : modoAltaDesdeEntorno();
  const { error } = await altaUsuario(supabaseAdmin, input, modo);
  return { error, modo };
}

/**
 * Botón manual "Recordar"/"Recordar por email" -- misma ventana de 5 días y
 * misma lógica de envío que el cron (src/lib/recordatorios/enviar.ts), pero
 * lee faltantes() con la sesión real del admin (no faltantes_recordatorio(),
 * exclusiva de service_role) para que el ámbito sea exactamente el que ya ve
 * en pantalla -- admin_grupo todo el grupo, admin_empresa solo su empresa.
 */
export async function enviarRecordatoriosManual(): Promise<{ error: string | null; procesados: number; omitidos: number }> {
  const perfil = await getPerfilServer();
  if (!perfil || !['admin_grupo', 'admin_empresa'].includes(perfil.rol)) {
    return { error: 'Sin permisos para enviar recordatorios', procesados: 0, omitidos: 0 };
  }

  const fechaHasta = hoyMadrid();
  const fechaDesde = sumarDias(fechaHasta, -VENTANA_DIAS_RECORDATORIO);

  const supabaseSesion = await createSessionClient();
  const { data, error } = await supabaseSesion.rpc('faltantes', { p_desde: fechaDesde, p_hasta: fechaHasta });
  if (error) return { error: error.message, procesados: 0, omitidos: 0 };

  const filas = (data ?? []).map((f: any) => ({
    perfilId: f.perfil_id,
    nombre: f.nombre,
    email: f.email,
    fecha: f.fecha,
    falta: Number(f.falta),
  }));

  const modo = process.env.MODO_EMAIL === 'real' ? 'real' : 'log';
  const resultado = await procesarRecordatorios(filas, modo, fechaDesde, fechaHasta);
  return { error: null, ...resultado };
}

/**
 * "Recordar por email" de la ficha de usuario -- mismo cálculo que el botón
 * general, pero filtrado a un solo empleado antes de procesar (respeta el
 * mismo ámbito de sesión y el mismo guardarraíl anti-spam de 1/día).
 */
export async function enviarRecordatorioEmpleado(perfilId: string): Promise<{ error: string | null; procesados: number; omitidos: number }> {
  const perfil = await getPerfilServer();
  if (!perfil || !['admin_grupo', 'admin_empresa'].includes(perfil.rol)) {
    return { error: 'Sin permisos para enviar recordatorios', procesados: 0, omitidos: 0 };
  }

  const fechaHasta = hoyMadrid();
  const fechaDesde = sumarDias(fechaHasta, -VENTANA_DIAS_RECORDATORIO);

  const supabaseSesion = await createSessionClient();
  const { data, error } = await supabaseSesion.rpc('faltantes', { p_desde: fechaDesde, p_hasta: fechaHasta });
  if (error) return { error: error.message, procesados: 0, omitidos: 0 };

  const filas = (data ?? [])
    .filter((f: any) => f.perfil_id === perfilId)
    .map((f: any) => ({
      perfilId: f.perfil_id,
      nombre: f.nombre,
      email: f.email,
      fecha: f.fecha,
      falta: Number(f.falta),
    }));

  const modo = process.env.MODO_EMAIL === 'real' ? 'real' : 'log';
  const resultado = await procesarRecordatorios(filas, modo, fechaDesde, fechaHasta);
  return { error: null, ...resultado };
}

/**
 * "Restablecer contraseña" de la ficha de usuario -- genera una temporal
 * legible y la devuelve UNA vez para que el admin la entregue en mano.
 * El objetivo se lee con la sesión real (RLS de perfil_select) en vez de
 * confiar en el perfilId del cliente: service_role bypassa RLS, así que el
 * ámbito admin_grupo/admin_empresa se replica aquí igual que en invitarUsuario.
 */
export async function restablecerPasswordEmpleado(perfilId: string): Promise<{ error: string | null; password: string | null }> {
  const perfil = await getPerfilServer();
  if (!perfil || !['admin_grupo', 'admin_empresa'].includes(perfil.rol)) {
    return { error: 'Sin permisos para restablecer contraseñas', password: null };
  }

  const supabaseSesion = await createSessionClient();
  const { data: objetivo } = await supabaseSesion.from('perfil').select('id, empresa_id, rol').eq('id', perfilId).single();
  if (!objetivo) return { error: 'Usuario no encontrado o fuera de tu ámbito', password: null };
  const errorPermisos = errorRestablecer(perfil, { empresa_id: objetivo.empresa_id, rol: objetivo.rol as RolUsuario });
  if (errorPermisos) return { error: errorPermisos, password: null };

  const password = generarPasswordTemporal();
  const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabaseAdmin.auth.admin.updateUserById(objetivo.id, { password });
  if (error) return { error: error.message, password: null };

  return { error: null, password };
}
