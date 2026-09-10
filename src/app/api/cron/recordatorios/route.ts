import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { procesarRecordatorios } from '@/lib/recordatorios/enviar';

const VENTANA_DIAS = 5;

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - VENTANA_DIAS);
  const fechaDesde = desde.toISOString().slice(0, 10);
  const fechaHasta = hoy.toISOString().slice(0, 10);

  const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // El cron diario respeta el interruptor global; el botón manual (server
  // action, otra vía) es siempre disponible independientemente de este ajuste.
  const { data: ajusteRow } = await supabaseAdmin.from('ajuste').select('valor').eq('clave', 'recordatorio_email').single();
  if (!ajusteRow?.valor) {
    return NextResponse.json({ modo: 'desactivado', procesados: 0, omitidos: 0 });
  }

  const { data, error } = await supabaseAdmin.rpc('faltantes_recordatorio', { p_desde: fechaDesde, p_hasta: fechaHasta });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filas = (data ?? []).map((f: any) => ({
    perfilId: f.perfil_id,
    nombre: f.nombre,
    email: f.email,
    fecha: f.fecha,
    falta: Number(f.falta),
  }));

  const modo = process.env.MODO_EMAIL === 'real' ? 'real' : 'log';
  const resultado = await procesarRecordatorios(filas, modo, fechaDesde, fechaHasta);

  return NextResponse.json({ modo, ...resultado });
}
