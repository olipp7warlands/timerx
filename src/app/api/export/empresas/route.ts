import { NextResponse } from 'next/server';
import { contextoAdminGrupo } from '@/lib/importadores/nucleo';
import { generarExport } from '@/lib/importadores/xlsx';
import { hoyMadrid } from '@/lib/importadores/fechas';
import { respuestaXlsx } from '@/lib/importadores/respuesta';

/** Empresas actuales con las cabeceras de la plantilla de importación (+ `activa`, que el importador ignora): punto de partida editable. */
export async function GET() {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const [empresas, areas] = await Promise.all([
    guard.ctx.supabase.from('empresa').select('nombre, cif, activa, area_id').order('nombre'),
    guard.ctx.supabase.from('mapa_area').select('id, nombre'),
  ]);
  if (empresas.error) return NextResponse.json({ error: empresas.error.message }, { status: 500 });
  const nombreArea = new Map((areas.data ?? []).map((a) => [a.id as string, a.nombre as string]));

  const filas = (empresas.data ?? []).map((e) => [e.nombre, e.cif ?? '', e.area_id ? (nombreArea.get(e.area_id) ?? '') : '', e.activa ? 'Sí' : 'No']);
  const buffer = await generarExport('Empresas', ['nombre', 'cif', 'tipologia', 'activa'], filas);
  return respuestaXlsx(buffer, `empresas_${hoyMadrid()}.xlsx`);
}
