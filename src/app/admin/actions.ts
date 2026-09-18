'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { procesarRecordatorios } from '@/lib/recordatorios/enviar';
import { altaUsuario, modoAltaDesdeEntorno, type AltaUsuarioInput, type ModoAlta } from '@/lib/usuarios/alta';

const VENTANA_DIAS_RECORDATORIO = 5;

const PALABRAS_PASSWORD = ['Roble', 'Nube', 'Rio', 'Monte', 'Brisa', 'Lago', 'Pino', 'Alba', 'Cielo', 'Prado', 'Faro', 'Bosque'];

function generarPasswordTemporal(): string {
  const palabra = PALABRAS_PASSWORD[Math.floor(Math.random() * PALABRAS_PASSWORD.length)];
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `${palabra}-${numero}`;
}

export type InvitarUsuarioInput = AltaUsuarioInput;

/**
 * Alta manual de UN usuario vía Admin API (service_role) -- solo puede correr en servidor. Misma operación y
 * mismo comportamiento que el importador masivo (`altaUsuario` + `MODO_EMAIL`): `real` invita por email;
 * cualquier otro valor (demo) crea la cuenta confirmada, sin contraseña y sin correo (acceso vía "Restablecer
 * contraseña" en su ficha). Devuelve `modo` para que la UI diga la verdad sobre lo que ha pasado.
 * handle_new_user() (001) lee empresa_id/nombre/rol de user_metadata y crea el perfil.
 * Un admin_empresa solo puede invitar dentro de su propia empresa y nunca a admin_grupo.
 */
export async function invitarUsuario(input: InvitarUsuarioInput): Promise<{ error: string | null; modo?: ModoAlta }> {
  const perfil = await getPerfilServer();
  if (!perfil || !['admin_grupo', 'admin_empresa'].includes(perfil.rol)) {
    return { error: 'Sin permisos para invitar usuarios' };
  }
  if (perfil.rol === 'admin_empresa' && (input.empresaId !== perfil.empresa_id || input.rol === 'admin_grupo')) {
    return { error: 'Un admin de empresa solo puede invitar dentro de su propia empresa' };
  }

  const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const modo = modoAltaDesdeEntorno();
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

  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - VENTANA_DIAS_RECORDATORIO);
  const fechaDesde = desde.toISOString().slice(0, 10);
  const fechaHasta = hoy.toISOString().slice(0, 10);

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

  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - VENTANA_DIAS_RECORDATORIO);
  const fechaDesde = desde.toISOString().slice(0, 10);
  const fechaHasta = hoy.toISOString().slice(0, 10);

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
  const { data: objetivo } = await supabaseSesion.from('perfil').select('id, empresa_id').eq('id', perfilId).single();
  if (!objetivo) return { error: 'Usuario no encontrado o fuera de tu ámbito', password: null };
  if (perfil.rol === 'admin_empresa' && objetivo.empresa_id !== perfil.empresa_id) {
    return { error: 'Un admin de empresa solo puede restablecer contraseñas de su propia empresa', password: null };
  }

  const password = generarPasswordTemporal();
  const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabaseAdmin.auth.admin.updateUserById(objetivo.id, { password });
  if (error) return { error: error.message, password: null };

  return { error: null, password };
}
