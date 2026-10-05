import { NextResponse } from 'next/server';
import { contextoAdminGrupo } from '@/lib/importadores/nucleo';
import { generarExport } from '@/lib/importadores/xlsx';
import { hoyMadrid } from '@/lib/importadores/fechas';
import { respuestaXlsx } from '@/lib/importadores/respuesta';

/** Empresas actuales con las cabeceras de la plantilla de importación (+ `activa`, que el importador ignora): punto de partida editable. */
export async function GET() {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const [empresas, areas, deptos] = await Promise.all([
    guard.ctx.supabase.from('empresa').select('id, nombre, cif, activa, area_id').order('nombre'),
    guard.ctx.supabase.from('mapa_area').select('id, nombre'),
    guard.ctx.supabase.from('empresa_departamento').select('empresa_id, departamento:departamento_id(nombre)'),
  ]);
  if (empresas.error) return NextResponse.json({ error: empresas.error.message }, { status: 500 });
  const nombreArea = new Map((areas.data ?? []).map((a) => [a.id as string, a.nombre as string]));

  const deptosDe = (id: string) =>
    ((deptos.data ?? []) as unknown as { empresa_id: string; departamento: { nombre: string } | null }[])
      .filter((d) => d.empresa_id === id)
      .map((d) => d.departamento?.nombre ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join('; ');
  const filas = (empresas.data ?? []).map((e) => [e.nombre, e.cif ?? '', e.area_id ? (nombreArea.get(e.area_id) ?? '') : '', deptosDe(e.id), e.activa ? 'Sí' : 'No']);
  const buffer = await generarExport('Empresas', ['nombre', 'cif', 'tipologia', 'departamentos', 'activa'], filas);
  return respuestaXlsx(buffer, `empresas_${hoyMadrid()}.xlsx`);
}
