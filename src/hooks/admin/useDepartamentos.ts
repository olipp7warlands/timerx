'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Departamento {
  id: string;
  nombre: string;
  responsableId: string | null;
  responsableNombre: string | null;
}

/** departamento_select es abierto; departamento_admin no acota por empresa (no tiene empresa_id: se documenta, no se inventa filtro). */
export function useDepartamentos() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('departamento').select('id, nombre, responsable_id, responsable:responsable_id(nombre)').order('nombre');
    setDepartamentos(
      (data ?? []).map((f: any) => ({
        id: f.id,
        nombre: f.nombre,
        responsableId: f.responsable_id,
        responsableNombre: f.responsable?.nombre ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(
    async (nombre: string, responsableId: string | null) => {
      const supabase = createClient();
      const { error } = await supabase.from('departamento').insert({ nombre, responsable_id: responsableId });
      if (!error) await recargar();
      return { error: error?.message ?? null };
    },
    [recargar]
  );

  return { departamentos, loading, recargar, crear };
}
