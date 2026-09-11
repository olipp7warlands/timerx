'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RolUsuario } from '@/lib/auth/roles';

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  empresaId: string;
  empresaNombre: string;
  departamento: string | null;
  categoriaNombre: string | null;
  activo: boolean;
}

const SELECT = `
  id, nombre, email, rol, empresa_id, activo,
  empresa:empresa_id(nombre),
  departamento:departamento_id(nombre),
  categoria:categoria_id(nombre)
`;

/** Listado de perfiles -- ya acotado por perfil_select (propia empresa + intragrupo para admin_empresa, 007/008). */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('perfil').select(SELECT).order('nombre');
    setUsuarios(
      (data ?? []).map((f: any) => ({
        id: f.id,
        nombre: f.nombre,
        email: f.email,
        rol: f.rol,
        empresaId: f.empresa_id,
        empresaNombre: f.empresa?.nombre ?? '',
        departamento: f.departamento?.nombre ?? null,
        categoriaNombre: f.categoria?.nombre ?? null,
        activo: f.activo,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { usuarios, loading, recargar };
}
