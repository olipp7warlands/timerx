'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { colorDeClave } from '@/lib/horas/colores-departamento';
import { departamentosVisibles } from '@/lib/horas/tareas';
import { useToast } from '@/components/empleado/compartido/Toast';

interface DatosVisibles {
  departamentos: { id: string; nombre: string; color: string | null; activas: number }[];
  deLaEmpresa: string[];
  fijados: string[];
}

/**
 * «Departamentos al imputar» (ficha de usuario, v2.0): qué especialidades puede imputar el profesional. Por defecto, las de los
 * departamentos de SU empresa; el admin puede fijar un conjunto EXACTO (acota O amplía: p. ej. un profesional de Wowinx que presta
 * servicio en Legal). Escribe admin_grupo y admin_empresa sobre los no-admin de su empresa (RLS de la 030).
 */
export function DepartamentosVisibles({ perfilId, empresaId, puedeEditar }: { perfilId: string; empresaId: string; puedeEditar: boolean }) {
  const toast = useToast();
  const [datos, setDatos] = useState<DatosVisibles | null>(null);
  const [modo, setModo] = useState<'empresa' | 'conjunto'>('empresa');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (): Promise<DatosVisibles> => {
    const supabase = createClient();
    const [deps, cats, emp, fij] = await Promise.all([
      supabase.from('departamento').select('id, nombre, color').eq('activo', true).order('nombre'),
      supabase.from('categoria').select('departamento_id, activa, subcategoria(activa)'),
      supabase.from('empresa_departamento').select('departamento_id').eq('empresa_id', empresaId),
      supabase.from('perfil_departamento').select('departamento_id').eq('perfil_id', perfilId),
    ]);
    const activasPorDep = new Map<string, number>();
    for (const c of (cats.data ?? []) as unknown as { departamento_id: string; activa: boolean; subcategoria: { activa: boolean }[] | null }[]) {
      if (c.activa) activasPorDep.set(c.departamento_id, (c.subcategoria ?? []).filter((s) => s.activa).length);
    }
    return {
      departamentos: (deps.data ?? []).map((d) => ({ id: d.id, nombre: d.nombre, color: d.color, activas: activasPorDep.get(d.id) ?? 0 })),
      deLaEmpresa: (emp.data ?? []).map((r) => r.departamento_id as string),
      fijados: (fij.data ?? []).map((r) => r.departamento_id as string),
    };
  }, [perfilId, empresaId]);

  useEffect(() => {
    let vivo = true;
    cargar().then((d) => {
      if (!vivo) return;
      setDatos(d);
      setModo(d.fijados.length > 0 ? 'conjunto' : 'empresa');
      setElegidos(d.fijados.length > 0 ? d.fijados : d.deLaEmpresa);
    });
    return () => {
      vivo = false;
    };
  }, [cargar]);

  const efectivos = useMemo(() => (datos ? departamentosVisibles(datos.deLaEmpresa, modo === 'conjunto' ? elegidos : []) : new Set<string>()), [datos, modo, elegidos]);
  const vistaPrevia = datos?.departamentos.filter((d) => efectivos.has(d.id) && d.activas > 0) ?? [];
  const totalEspecialidades = vistaPrevia.reduce((s, d) => s + d.activas, 0);
  const fuera = datos ? elegidos.filter((id) => modo === 'conjunto' && !datos.deLaEmpresa.includes(id)) : [];

  const guardadoModo = datos ? (datos.fijados.length > 0 ? 'conjunto' : 'empresa') : modo;
  const cambia =
    datos !== null &&
    (modo !== guardadoModo || (modo === 'conjunto' && (elegidos.length !== datos.fijados.length || elegidos.some((e) => !datos.fijados.includes(e)))));
  const conjuntoVacio = modo === 'conjunto' && elegidos.length === 0;

  async function guardar() {
    if (!datos || conjuntoVacio) return;
    const supabase = createClient();
    const destino = modo === 'conjunto' ? elegidos : [];
    const alta = destino.filter((e) => !datos.fijados.includes(e));
    const baja = datos.fijados.filter((e) => !destino.includes(e));
    setGuardando(true);
    let error: string | null = null;
    if (baja.length > 0) error = (await supabase.from('perfil_departamento').delete().eq('perfil_id', perfilId).in('departamento_id', baja)).error?.message ?? null;
    if (!error && alta.length > 0) error = (await supabase.from('perfil_departamento').insert(alta.map((d) => ({ perfil_id: perfilId, departamento_id: d })))).error?.message ?? null;
    if (!error) {
      const d = await cargar();
      setDatos(d);
      setModo(d.fijados.length > 0 ? 'conjunto' : 'empresa');
      setElegidos(d.fijados.length > 0 ? d.fijados : d.deLaEmpresa);
    }
    setGuardando(false);
    toast(error ?? 'Departamentos al imputar actualizados', error ? 'error' : undefined);
  }

  return (
    <div className="card" data-testid="departamentos-visibles">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Departamentos al imputar</h2>
      </div>
      <div className="card-body space-y-3">
        {datos === null ? (
          <p className="text-sm text-ink-tertiary">Cargando…</p>
        ) : (
          <>
            <fieldset className="space-y-1.5" disabled={!puedeEditar}>
              <legend className="sr-only">Qué departamentos puede imputar</legend>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="radio" name={`modo-${perfilId}`} checked={modo === 'empresa'} onChange={() => setModo('empresa')} />
                Los de su empresa (predeterminado)
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="radio" name={`modo-${perfilId}`} checked={modo === 'conjunto'} onChange={() => setModo('conjunto')} />
                Un conjunto concreto
              </label>
            </fieldset>

            {modo === 'conjunto' && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5" data-testid="conjunto-departamentos">
                {datos.departamentos.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5 text-sm font-bold">
                    <input
                      type="checkbox"
                      disabled={!puedeEditar}
                      checked={elegidos.includes(d.id)}
                      onChange={(ev) => setElegidos(ev.target.checked ? [...elegidos, d.id] : elegidos.filter((x) => x !== d.id))}
                    />
                    <span className="h-2 w-2 rounded-full" style={{ background: colorDeClave(d.color) }} aria-hidden="true" />
                    {d.nombre}
                    {!datos.deLaEmpresa.includes(d.id) && <span className="mapa-tag">fuera de su empresa</span>}
                  </label>
                ))}
              </div>
            )}
            {fuera.length > 0 && <p className="text-xs text-ink-tertiary">Incluye departamentos que su empresa no tiene: podrá imputar sus especialidades igualmente (p. ej. servicio a otra empresa del grupo).</p>}
            {conjuntoVacio && <p className="text-xs font-bold text-ink-primary">Elige al menos un departamento, o vuelve a «Los de su empresa».</p>}

            <p className="text-xs text-ink-secondary" data-testid="vista-previa-visibles">
              {totalEspecialidades === 0 ? (
                <b>No verá ninguna especialidad al imputar.</b>
              ) : (
                <>
                  Verá <b>{totalEspecialidades}</b> especialidad{totalEspecialidades === 1 ? '' : 'es'}: {vistaPrevia.map((d) => `${d.nombre} (${d.activas})`).join(' · ')}
                </>
              )}
            </p>

            {puedeEditar && (
              <button type="button" className="btn btn-primary btn-sm" disabled={!cambia || guardando || conjuntoVacio} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
