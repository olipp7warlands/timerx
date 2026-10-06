import { createClient } from '@/lib/supabase/client';

/** Mensaje de la guarda al quitar una empresa de un departamento (misma familia que «reubícalos antes» de desactivar). */
export const mensajeVinculoOcupado = (n: number) => `Reubica antes a sus ${n} profesional${n === 1 ? '' : 'es'}.`;

/**
 * ÚNICA mutación sobre `empresa_departamento` (la usan la ficha del departamento y la ficha de la empresa).
 * Poner la marca = insertar el vínculo; quitarla = borrarlo, pero NUNCA si la empresa tiene profesionales EN ACTIVO asignados al
 * departamento (perderían la visibilidad de sus especialidades al imputar). La cuenta se hace en la BD en el momento, no con datos en caché.
 */
export async function fijarVinculoEmpresa(empresaId: string, departamentoId: string, existe: boolean): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (existe) {
    const { error } = await supabase
      .from('empresa_departamento')
      .upsert({ empresa_id: empresaId, departamento_id: departamentoId }, { onConflict: 'empresa_id,departamento_id', ignoreDuplicates: true });
    return { error: error?.message ?? null };
  }
  const { count, error: eCuenta } = await supabase
    .from('perfil')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('departamento_id', departamentoId)
    .eq('activo', true);
  if (eCuenta) return { error: eCuenta.message };
  if ((count ?? 0) > 0) return { error: mensajeVinculoOcupado(count ?? 0) };
  const { data, error } = await supabase.from('empresa_departamento').delete().eq('empresa_id', empresaId).eq('departamento_id', departamentoId).select('empresa_id');
  if (!error && (data?.length ?? 0) === 0) return { error: 'No se pudo quitar: no tienes permisos sobre los departamentos de la empresa.' };
  return { error: error?.message ?? null };
}
