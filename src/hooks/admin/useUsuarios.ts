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
  departamentoId: string | null;
  departamento: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  activo: boolean;
}

export interface ActualizarUsuarioInput {
  empresaId: string;
  departamentoId: string | null;
  categoriaId: string | null;
  rol: RolUsuario;
}

const SELECT = `
  id, nombre, email, rol, empresa_id, departamento_id, categoria_id, activo,
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
        departamentoId: f.departamento_id,
        departamento: f.departamento?.nombre ?? null,
        categoriaId: f.categoria_id,
        categoriaNombre: f.categoria?.nombre ?? null,
        activo: f.activo,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  /** Update de perfil (empresa/departamento/categoría/rol) -- perfil_update_admin ya acota admin_empresa a su propia empresa, sin excepción intragrupo. */
  const actualizar = useCallback(
    async (id: string, input: ActualizarUsuarioInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('perfil')
        .update({ empresa_id: input.empresaId, departamento_id: input.departamentoId, categoria_id: input.categoriaId, rol: input.rol })
        .eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  /** Baja lógica -- no bloquea login hoy (ver ficha de usuario), solo deja de contar en faltantes()/resumen_dia()/resumen_mes()/estado_dias_mes(). */
  const desactivar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('perfil').update({ activo: false }).eq('id', id);
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { usuarios, loading, recargar, actualizar, desactivar };
}
