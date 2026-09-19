'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AreaTipologia {
  id: string;
  nombre: string;
  color: string;
}

/**
 * Áreas ACTIVAS del Mapa del grupo, que son las tipologías posibles de una empresa o un proyecto (020). Lectura abierta
 * (`mapa_area_select`). `colorDe` (id → color) alimenta a `coloresRosco`.
 */
export function useAreasTipologia() {
  const [areas, setAreas] = useState<AreaTipologia[]>([]);

  useEffect(() => {
    let vigente = true;
    createClient()
      .from('mapa_area')
      .select('id, nombre, color')
      .eq('activa', true)
      .order('orden')
      .then(({ data }) => {
        if (vigente) setAreas(data ?? []);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const colorDe = useMemo(() => Object.fromEntries(areas.map((a) => [a.id, a.color])) as Record<string, string>, [areas]);
  return { areas, colorDe };
}
