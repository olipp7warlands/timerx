import { NextResponse } from 'next/server';
import { contextoAdminGrupo } from '@/lib/importadores/nucleo';
import { generarExport } from '@/lib/importadores/xlsx';
import { hoyMadrid } from '@/lib/importadores/fechas';

/** Coste/hora VIGENTE por usuario (v_coste_vigente, security_invoker: la RLS solo admin_grupo aplica también aquí). Vacío = sin coste vigente. */
export async function GET() {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const [perfiles, vigentes] = await Promise.all([
    guard.ctx.supabase.from('perfil').select('id, nombre, email').order('nombre'),
    guard.ctx.supabase.from('v_coste_vigente').select('perfil_id, coste_hora, desde'),
  ]);
  const error = perfiles.error ?? vigentes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const porPerfil = new Map((vigentes.data ?? []).map((c) => [c.perfil_id, c]));
  const filas = (perfiles.data ?? []).map((p) => {
    const c = porPerfil.get(p.id);
    return [p.nombre, p.email, c ? Number(c.coste_hora) : null, c?.desde ?? null];
  });
  const buffer = await generarExport('Coste por hora', ['nombre', 'email', 'coste_hora', 'desde'], filas);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="coste_vigente_${hoyMadrid()}.xlsx"`,
    },
  });
}
