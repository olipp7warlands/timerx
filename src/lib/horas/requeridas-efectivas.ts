import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Contrato "requeridas efectivas" (PLAN.md sección 4):
 *
 *   requeridas_efectivas(empleado, mes) =
 *     horas_requeridas_mes(empresa) - (dias_vacaciones + dias_baja + dias_permiso) x jornada
 *
 * Única fuente para: FTE s/requeridas del export (F4), KPIs del admin y balance
 * del empleado. Los ingredientes crudos vienen de Supabase (RPCs `fte_mes` /
 * `balance_mes` + `ajuste.jornada_horas`); la resta se hace aquí una sola vez
 * para no duplicarla entre esos tres consumidores.
 */
export interface IngredientesRequeridas {
  horasRequeridas: number;
  diasVacaciones: number;
  diasBaja: number;
  diasPermiso: number;
  jornadaHoras: number;
}

export function requeridasEfectivas({
  horasRequeridas,
  diasVacaciones,
  diasBaja,
  diasPermiso,
  jornadaHoras,
}: IngredientesRequeridas): number {
  return horasRequeridas - (diasVacaciones + diasBaja + diasPermiso) * jornadaHoras;
}

/** `ajuste.jornada_horas` es configurable en BD (panel > Calendario): no hardcodear 7. */
export async function getJornadaHoras(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from('ajuste').select('valor').eq('clave', 'jornada_horas').single();
  return Number(data?.valor ?? 7);
}
