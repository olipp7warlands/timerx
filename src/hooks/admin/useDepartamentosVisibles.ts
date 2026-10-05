'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cargarDepartamentosVisibles } from '@/lib/horas/visibles';

/**
 * Departamentos cuyas especialidades puede imputar la persona `perfilId` (la MISMA regla que ve ella: su conjunto fijado o los de su
 * empresa). Lo usa la imputación directa del admin (persona DESTINO) y la vista «¿Qué ve este profesional?». `null` = sin persona o
 * aún cargando.
 */
export function useDepartamentosVisibles(perfilId: string | null | undefined, empresaId: string | null | undefined) {
  const [estado, setEstado] = useState<{ clave: string; visibles: Set<string> } | null>(null);
  const clave = perfilId && empresaId ? `${perfilId}|${empresaId}` : '';

  useEffect(() => {
    if (!perfilId || !empresaId) return;
    let cancelado = false;
    cargarDepartamentosVisibles(createClient(), perfilId, empresaId).then((visibles) => {
      if (!cancelado) setEstado({ clave: `${perfilId}|${empresaId}`, visibles });
    });
    return () => {
      cancelado = true;
    };
  }, [perfilId, empresaId]);

  // Un resultado de OTRA persona (cambio de selección en curso) no se usa.
  return clave && estado?.clave === clave ? estado.visibles : null;
}
