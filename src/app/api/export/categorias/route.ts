import { NextResponse } from 'next/server';
import { contextoAdminGrupo } from '@/lib/importadores/nucleo';
import { generarExport } from '@/lib/importadores/xlsx';
import { hoyMadrid } from '@/lib/importadores/fechas';
import { respuestaXlsx } from '@/lib/importadores/respuesta';

interface FilaCategoria {
  nombre: string;
  departamento: { nombre: string } | null;
  subcategoria: { nombre: string }[];
}

/**
 * Catálogo completo, una fila por ESPECIALIDAD (departamento, especialidad): las mismas cabeceras que la plantilla (v2.0).
 * La ruta conserva su id `categorias` (id de API, superviviente); el contenido es el del modelo nuevo.
 */
export async function GET() {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const { data, error } = await guard.ctx.supabase.from('categoria').select('nombre, departamento:departamento_id(nombre), subcategoria(nombre)').order('nombre');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = ((data ?? []) as unknown as FilaCategoria[]).flatMap((c) =>
    [...c.subcategoria].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((s) => [c.departamento?.nombre ?? c.nombre, s.nombre])
  );
  const buffer = await generarExport('Especialidades', ['departamento', 'especialidad'], filas);
  return respuestaXlsx(buffer, `especialidades_${hoyMadrid()}.xlsx`);
}
