'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RolUsuario } from '@/lib/auth/roles';

const SIN_PERMISO_PERFIL = 'No tienes permiso para modificar este perfil';

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

/**
 * Solo se escriben los campos PRESENTES. La ficha los manda todos (formulario completo); la edición inline de la tabla manda
 * únicamente el que se ha cambiado: así una fila con datos cacheados no reescribe (ni pisa) campos que otro admin haya
 * cambiado entretanto. `null` en departamento/categoría significa "quitar"; `undefined`, "no tocar".
 */
export interface ActualizarUsuarioInput {
  empresaId?: string;
  departamentoId?: string | null;
  categoriaId?: string | null;
  rol?: RolUsuario;
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

  /**
   * Update de perfil (empresa/departamento/categoría/rol). RLS (perfil_update_admin) acota admin_empresa a su propia empresa,
   * y el trigger de la 021 reserva a admin_grupo el cambio EFECTIVO de rol y de empresa: quien no lo sea no debe enviarlos.
   */
  const actualizar = useCallback(
    async (id: string, input: ActualizarUsuarioInput) => {
      const supabase = createClient();
      const cambios = {
        ...(input.empresaId !== undefined && { empresa_id: input.empresaId }),
        ...(input.departamentoId !== undefined && { departamento_id: input.departamentoId }),
        ...(input.categoriaId !== undefined && { categoria_id: input.categoriaId }),
        ...(input.rol !== undefined && { rol: input.rol }),
      };
      const { data, error } = await supabase.from('perfil').update(cambios).eq('id', id).select('id');
      if (error) return { error: error.message };
      // RLS (perfil_update_admin, 022) no da error cuando la fila queda fuera de ámbito: da 0 filas. Nunca un falso «guardado».
      if (!data?.length) return { error: SIN_PERMISO_PERFIL };
      await recargar();
      return { error: null };
    },
    [recargar]
  );

  /** Baja lógica -- no bloquea login hoy (ver ficha de usuario), solo deja de contar en faltantes()/resumen_dia()/resumen_mes()/estado_dias_mes(). */
  const desactivar = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('perfil').update({ activo: false }).eq('id', id).select('id');
      if (error) return { error: error.message };
      if (!data?.length) return { error: SIN_PERMISO_PERFIL };
      await recargar();
      return { error: null };
    },
    [recargar]
  );

  return { usuarios, loading, recargar, actualizar, desactivar };
}
