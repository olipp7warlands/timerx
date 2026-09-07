'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPerfilServer } from '@/lib/supabase/perfil';

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
