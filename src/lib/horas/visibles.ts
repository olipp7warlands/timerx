import type { SupabaseClient } from '@supabase/supabase-js';
import { departamentosVisibles, type CategoriaCatalogo } from './tareas';

interface FilaSubcategoria {
  id: string;
  nombre: string;
  categoria: { id: string; nombre: string; departamento_id: string; activa: boolean } | null;
}

/** Catálogo de especialidades ACTIVAS con su departamento (espejo activo). Una sola lectura; el reparto se recalcula aparte. */
export async function cargarCatalogo(supabase: SupabaseClient): Promise<CategoriaCatalogo[]> {
  const { data } = await supabase
    .from('subcategoria')
    .select('id, nombre, categoria_id, categoria:categoria_id(id, nombre, departamento_id, activa)')
    .eq('activa', true)
    .order('nombre');

  const porDepartamento = new Map<string, CategoriaCatalogo>();
  for (const s of (data ?? []) as unknown as FilaSubcategoria[]) {
    const cat = s.categoria;
    if (!cat || !cat.activa) continue;
    if (!porDepartamento.has(cat.id)) {
      porDepartamento.set(cat.id, { categoriaId: cat.id, categoriaNombre: cat.nombre, departamentoId: cat.departamento_id, subcategorias: [] });
    }
    porDepartamento.get(cat.id)!.subcategorias.push({ id: s.id, nombre: s.nombre });
  }
  return [...porDepartamento.values()];
}

/**
 * Departamentos cuyas especialidades puede imputar una persona: los de `perfil_departamento` si el admin fijó alguno, y si no, los de
 * su empresa (`empresa_departamento`). La RLS deja a cada profesional leer sus propias filas; un admin lee las de su ámbito.
 */
export async function cargarDepartamentosVisibles(supabase: SupabaseClient, perfilId: string, empresaId: string): Promise<Set<string>> {
  const [fijados, empresa] = await Promise.all([
    supabase.from('perfil_departamento').select('departamento_id').eq('perfil_id', perfilId),
    supabase.from('empresa_departamento').select('departamento_id').eq('empresa_id', empresaId),
  ]);
  return departamentosVisibles(
    (empresa.data ?? []).map((r) => r.departamento_id as string),
    (fijados.data ?? []).map((r) => r.departamento_id as string)
  );
}
