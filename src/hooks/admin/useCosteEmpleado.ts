'use client';

import { hoyMadrid } from '@/lib/fechas';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CosteVigente {
  costeHora: number;
  desde: string;
}

export interface VersionCoste extends CosteVigente {
  id: string;
  /** `desde` posterior a hoy: versión registrada pero aún no en vigor. */
  programado: boolean;
}

/** Versiones que muestra el mini-histórico de la ficha. */
const VERSIONES_VISIBLES = 3;

async function leerCoste(perfilId: string): Promise<{ vigente: CosteVigente | null; historico: VersionCoste[] }> {
  const supabase = createClient();
  const [{ data: vig }, { data: filas }] = await Promise.all([
    supabase.from('v_coste_vigente').select('coste_hora, desde').eq('perfil_id', perfilId).maybeSingle(),
    supabase.from('coste_empleado').select('id, coste_hora, desde').eq('perfil_id', perfilId).order('desde', { ascending: false }).limit(VERSIONES_VISIBLES),
  ]);
  const hoy = hoyMadrid();
  return {
    vigente: vig?.desde ? { costeHora: Number(vig.coste_hora), desde: vig.desde } : null,
    historico: (filas ?? []).map((f) => ({ id: f.id, costeHora: Number(f.coste_hora), desde: f.desde, programado: f.desde > hoy })),
  };
}

/**
 * Coste/hora de UN empleado: el vigente (mayor `desde` <= hoy, vía `v_coste_vigente`, security_invoker), las últimas versiones y el alta de
 * una versión nueva. Dato salarial: la RLS de `coste_empleado` solo deja pasar a admin_grupo, y el llamador SOLO debe activar el hook para
 * admin_grupo (`habilitado`); para cualquier otro rol no se lanza ni una consulta.
 *
 * `registrar` es SIEMPRE un INSERT (016: versionado por fecha, nunca update): (perfil_id, desde) es único, y repetir la fecha es un error
 * que se explica, no un pisado. Cambiar un coste = registrar otra versión con otra fecha.
 */
export function useCosteEmpleado(perfilId: string, habilitado: boolean) {
  const [estado, setEstado] = useState<{ vigente: CosteVigente | null; historico: VersionCoste[] }>({ vigente: null, historico: [] });
  const [loading, setLoading] = useState(habilitado);

  useEffect(() => {
    if (!habilitado) return;
    let vigente = true;
    leerCoste(perfilId).then((r) => {
      if (!vigente) return;
      setEstado(r);
      setLoading(false);
    });
    return () => {
      vigente = false;
    };
  }, [perfilId, habilitado]);

  const registrar = useCallback(
    async (costeHora: number, desde: string): Promise<{ error: string | null }> => {
      if (!Number.isFinite(costeHora) || costeHora < 0) return { error: 'El importe debe ser un número igual o mayor que 0' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return { error: 'Indica la fecha desde la que rige el coste' };
      const { error } = await createClient().from('coste_empleado').insert({ perfil_id: perfilId, coste_hora: costeHora, desde });
      if (error) {
        if (error.code === '23505') {
          return { error: 'Ya hay un coste registrado para esa fecha. Los costes son versiones y no se editan: elige otra fecha «desde».' };
        }
        return { error: error.message };
      }
      setEstado(await leerCoste(perfilId));
      return { error: null };
    },
    [perfilId]
  );

  return { coste: estado.vigente, historico: estado.historico, loading, registrar };
}
