'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { procesarRecordatorios } from '@/lib/recordatorios/enviar';

const VENTANA_DIAS_RECORDATORIO = 5;

export interface InvitarUsuarioInput {
  email: string;
  nombre: string;
  empresaId: string;
  departamentoId?: string | null;
  rol: 'empleado' | 'responsable_proyecto' | 'admin_empresa' | 'admin_grupo';
  categoriaId?: string | null;
}

/**
 * Invitación real vía Admin API (service_role) -- solo puede correr en servidor.
 * handle_new_user() (001) lee empresa_id/nombre/rol de user_metadata y crea el perfil.
 * Un admin_empresa solo puede invitar dentro de su propia empresa y nunca a admin_grupo.
 */
export async function invitarUsuario(input: InvitarUsuarioInput): Promise<{ error: string | null }> {
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

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
    data: {
      empresa_id: input.empresaId,
      nombre: input.nombre,
      rol: input.rol,
    },
  });
  if (error) return { error: error.message };

  if (input.departamentoId || input.categoriaId) {
    const { data: nuevo } = await supabaseAdmin.from('perfil').select('id').eq('email', input.email).single();
    if (nuevo) {
      await supabaseAdmin
        .from('perfil')
        .update({ departamento_id: input.departamentoId ?? null, categoria_id: input.categoriaId ?? null })
        .eq('id', nuevo.id);
    }
  }

  return { error: null };
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
