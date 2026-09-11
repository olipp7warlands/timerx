import type { Database } from '@/lib/supabase/types';

export type RolUsuario = Database['public']['Enums']['rol_usuario'];

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  empleado: 'Empleado',
  responsable_proyecto: 'Responsable de proyecto',
  admin_empresa: 'Admin de empresa',
  admin_grupo: 'Admin del grupo',
};
