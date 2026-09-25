import { NextResponse } from 'next/server';
import { contextoAdminGrupo } from '@/lib/importadores/nucleo';
import { generarExport } from '@/lib/importadores/xlsx';
import { hoyMadrid } from '@/lib/importadores/fechas';
import { respuestaXlsx } from '@/lib/importadores/respuesta';

interface FilaProyecto {
  codigo: string;
  nombre: string;
  activo: boolean;
  area_id: string | null;
  empresa: { nombre: string } | null;
}

/** Proyectos actuales con las cabeceras de la plantilla de importación (+ `estado`, que el importador ignora). `tipologia` = la PROPIA del proyecto. */
export async function GET() {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const [proyectos, areas] = await Promise.all([
    guard.ctx.supabase.from('proyecto').select('codigo, nombre, activo, area_id, empresa:empresa_id(nombre)').order('nombre'),
    guard.ctx.supabase.from('mapa_area').select('id, nombre'),
  ]);
  if (proyectos.error) return NextResponse.json({ error: proyectos.error.message }, { status: 500 });
  const nombreArea = new Map((areas.data ?? []).map((a) => [a.id as string, a.nombre as string]));

  const filas = ((proyectos.data ?? []) as unknown as FilaProyecto[])
    .sort((a, b) => (a.empresa?.nombre ?? '').localeCompare(b.empresa?.nombre ?? '') || a.codigo.localeCompare(b.codigo))
    .map((p) => [p.empresa?.nombre ?? '', p.codigo, p.nombre, p.area_id ? (nombreArea.get(p.area_id) ?? '') : '', p.activo ? 'Activo' : 'Inactivo']);
  const buffer = await generarExport('Proyectos', ['empresa', 'codigo', 'nombre', 'tipologia', 'estado'], filas);
  return respuestaXlsx(buffer, `proyectos_${hoyMadrid()}.xlsx`);
}
