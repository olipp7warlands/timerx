import { NextRequest, NextResponse } from 'next/server';
import { importadorDe } from '@/lib/importadores/registro';
import { contextoAdminGrupo, plantillaDe } from '@/lib/importadores/nucleo';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const guard = await contextoAdminGrupo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 403 });

  const { tipo } = await params;
  const def = importadorDe(tipo);
  if (!def) return NextResponse.json({ error: 'Plantilla desconocida' }, { status: 404 });

  return new NextResponse(new Uint8Array(await plantillaDe(def)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla_${def.id}.xlsx"`,
    },
  });
}
