import { NextResponse } from 'next/server';
import { contextoAdminGrupo } from '@/lib/importadores/nucleo';
import { generarExport } from '@/lib/importadores/xlsx';
import { hoyMadrid } from '@/lib/importadores/fechas';

interface FilaPerfil {
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  empresa: { nombre: string } | null;
  departamento: { nombre: string } | null;
  categoria: { nombre: string } | null;
}

/** Usuarios actuales con las cabeceras de la plantilla de importación (+ `activo`, que el importador ignora): punto de partida editable. */
export async function GET() {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const { data, error } = await guard.ctx.supabase
    .from('perfil')
    .select('nombre, email, rol, activo, empresa:empresa_id(nombre), departamento:departamento_id(nombre), categoria:categoria_id(nombre)')
    .order('nombre');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = ((data ?? []) as unknown as FilaPerfil[]).map((p) => [p.nombre, p.email, p.empresa?.nombre ?? '', p.departamento?.nombre ?? '', p.categoria?.nombre ?? '', p.rol, p.activo ? 'Sí' : 'No']);
  const buffer = await generarExport('Usuarios', ['nombre', 'email', 'empresa', 'departamento', 'categoria', 'rol', 'activo'], filas);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="usuarios_${hoyMadrid()}.xlsx"`,
    },
  });
}
