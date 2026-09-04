'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function usePerfil() {
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function cargarPerfil() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPerfil(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('perfil')
        .select('*, empresa(*), departamento:departamento!perfil_departamento_id_fkey(*)')
        .eq('id', user.id)
        .single();

      setPerfil(data);
      setLoading(false);
    }

    cargarPerfil();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => cargarPerfil());

    return () => subscription.unsubscribe();
  }, []);

  return { perfil, loading };
}
