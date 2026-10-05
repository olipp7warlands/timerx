'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { colorDeClave } from '@/lib/horas/colores-departamento';
import { useToast } from '@/components/empleado/compartido/Toast';

export interface DepartamentoOpcion {
  id: string;
  nombre: string;
  color: string | null;
}

/** Departamentos ACTIVOS (para elegir en el alta y la edición de una empresa). */
export function useDepartamentosActivos() {
  const [departamentos, setDepartamentos] = useState<DepartamentoOpcion[]>([]);
  useEffect(() => {
    let vivo = true;
    createClient()
      .from('departamento')
      .select('id, nombre, color')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (vivo) setDepartamentos((data ?? []).map((d) => ({ id: d.id, nombre: d.nombre, color: d.color })));
      });
    return () => {
      vivo = false;
    };
  }, []);
  return departamentos;
}

/** Casillas de departamento (controlado). Sin ninguno marcado, la empresa no ofrece especialidades al imputar: se avisa. */
export function SelectorDepartamentos({
  departamentos,
  value,
  onChange,
  disabled = false,
}: {
  departamentos: DepartamentoOpcion[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {departamentos.map((d) => (
          <label key={d.id} className="flex items-center gap-1.5 text-sm font-bold">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.includes(d.id)}
              onChange={(ev) => onChange(ev.target.checked ? [...value, d.id] : value.filter((x) => x !== d.id))}
            />
            <span className="h-2 w-2 rounded-full" style={{ background: colorDeClave(d.color) }} aria-hidden="true" />
            {d.nombre}
          </label>
        ))}
      </div>
      {value.length === 0 && departamentos.length > 0 && (
        <p className="mt-1.5 text-xs font-bold text-ink-primary">⚠ Sin departamentos: sus profesionales no verán ninguna especialidad al imputar.</p>
      )}
    </div>
  );
}

/** Tarjeta «Departamentos de la empresa» de la ficha: define qué departamentos EXISTEN en ella. Edita solo admin_grupo (RLS). */
export function DepartamentosDeEmpresa({ empresaId, puedeEditar }: { empresaId: string; puedeEditar: boolean }) {
  const toast = useToast();
  const departamentos = useDepartamentosActivos();
  const [guardados, setGuardados] = useState<string[] | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await createClient().from('empresa_departamento').select('departamento_id').eq('empresa_id', empresaId);
    return (data ?? []).map((r) => r.departamento_id as string);
  }, [empresaId]);

  useEffect(() => {
    let vivo = true;
    cargar().then((ids) => {
      if (!vivo) return;
      setGuardados(ids);
      setElegidos(ids);
    });
    return () => {
      vivo = false;
    };
  }, [cargar]);

  const cambia = guardados !== null && (elegidos.length !== guardados.length || elegidos.some((e) => !guardados.includes(e)));

  async function guardar() {
    if (guardados === null) return;
    const supabase = createClient();
    const alta = elegidos.filter((e) => !guardados.includes(e));
    const baja = guardados.filter((e) => !elegidos.includes(e));
    setGuardando(true);
    let error: string | null = null;
    if (alta.length > 0) error = (await supabase.from('empresa_departamento').insert(alta.map((d) => ({ empresa_id: empresaId, departamento_id: d })))).error?.message ?? null;
    if (!error && baja.length > 0) error = (await supabase.from('empresa_departamento').delete().eq('empresa_id', empresaId).in('departamento_id', baja)).error?.message ?? null;
    if (!error) {
      const ids = await cargar();
      setGuardados(ids);
      setElegidos(ids);
    }
    setGuardando(false);
    toast(error ?? 'Departamentos de la empresa actualizados', error ? 'error' : undefined);
  }

  return (
    <div className="card" data-testid="departamentos-empresa">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Departamentos de la empresa</h2>
      </div>
      <div className="card-body space-y-3">
        <p className="text-xs text-ink-tertiary">
          Definen qué departamentos existen en esta empresa y, con ello, qué especialidades pueden imputar sus profesionales (salvo que su admin les fije un conjunto concreto).
        </p>
        <SelectorDepartamentos departamentos={departamentos} value={elegidos} onChange={setElegidos} disabled={!puedeEditar || guardados === null} />
        {puedeEditar && (
          <button type="button" className="btn btn-primary btn-sm" disabled={!cambia || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar departamentos'}
          </button>
        )}
      </div>
    </div>
  );
}
