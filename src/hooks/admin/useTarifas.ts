'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Tarifa {
  id: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  empleadoId: string | null;
  empleadoNombre: string | null;
  empresaOrigenId: string | null;
  empresaOrigenNombre: string | null;
  costeHora: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export interface NuevaTarifa {
  categoriaId?: string | null;
  empleadoId?: string | null;
  empresaOrigenId?: string | null;
  costeHora: number;
  vigenteDesde: string;
  vigenteHasta?: string | null;
}

/** tarifa_select visible a admin_grupo/admin_empresa (todo el grupo); escritura solo admin_grupo. */
export function useTarifas() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('tarifa')
      .select(
        'id, categoria_id, empleado_id, empresa_origen_id, coste_hora, vigente_desde, vigente_hasta, categoria:categoria_id(nombre), empleado:empleado_id(nombre), empresa_origen:empresa_origen_id(nombre)'
      )
      .order('vigente_desde', { ascending: false });
    setTarifas(
      (data ?? []).map((f: any) => ({
        id: f.id,
        categoriaId: f.categoria_id,
        categoriaNombre: f.categoria?.nombre ?? null,
        empleadoId: f.empleado_id,
        empleadoNombre: f.empleado?.nombre ?? null,
        empresaOrigenId: f.empresa_origen_id,
        empresaOrigenNombre: f.empresa_origen?.nombre ?? null,
        costeHora: Number(f.coste_hora),
        vigenteDesde: f.vigente_desde,
        vigenteHasta: f.vigente_hasta,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(
    async (nueva: NuevaTarifa) => {
      const supabase = createClient();
      const { error } = await supabase.from('tarifa').insert({
        categoria_id: nueva.categoriaId ?? null,
        empleado_id: nueva.empleadoId ?? null,
        empresa_origen_id: nueva.empresaOrigenId ?? null,
        coste_hora: nueva.costeHora,
        vigente_desde: nueva.vigenteDesde,
        vigente_hasta: nueva.vigenteHasta ?? null,
      });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { tarifas, loading, recargar, crear };
}
