import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Contrato "requeridas efectivas" (PLAN.md sección 4):
 *
 *   requeridas_efectivas(empleado, mes) =
 *     horas_requeridas_mes(empresa) - horas de ausencia aprobada del mes
 *
 * con "horas de ausencia" = SUMA de la jornada de cada día laborable cubierto (019: la jornada es semanal por
 * empresa, así que un viernes de 5,5 h descuenta 5,5, no 7 ni 8). Única fuente para: FTE s/requeridas del export
 * (F4), KPIs del admin, ficha de usuario y balance del empleado. Los ingredientes crudos vienen de Supabase
 * (`balance_mes`/`balance_mes_empleado`/`fte_mes` para las horas requeridas y `requeridas_efectivas()` para las
 * horas de ausencia); la resta se hace aquí una sola vez para no duplicarla entre esos consumidores.
 */
export interface IngredientesRequeridas {
  horasRequeridas: number;
  horasAusencia: number;
}

export function requeridasEfectivas({ horasRequeridas, horasAusencia }: IngredientesRequeridas): number {
  return horasRequeridas - horasAusencia;
}

/** Horas de ausencia aprobada del mes por empleado, en el ámbito del que llama (`requeridas_efectivas()`, 019). */
export async function getHorasAusenciaMes(
  supabase: SupabaseClient,
  anio: number,
  mes: number
): Promise<{ porPerfil: Map<string, number>; porEmail: Map<string, number> }> {
  const { data } = await supabase.rpc('requeridas_efectivas', { p_anio: anio, p_mes: mes });
  const filas = (data ?? []) as { perfil_id: string; email: string; horas_ausencia: number }[];
  return {
    porPerfil: new Map(filas.map((f) => [f.perfil_id, Number(f.horas_ausencia)])),
    porEmail: new Map(filas.map((f) => [f.email, Number(f.horas_ausencia)])),
  };
}
