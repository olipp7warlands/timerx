import { createClient as createServiceClient } from '@supabase/supabase-js';

export interface FilaFaltante {
  perfilId: string;
  nombre: string;
  email: string;
  fecha: string;
  falta: number;
}

export interface ResultadoRecordatorios {
  procesados: number;
  omitidos: number;
}

const APP_URL = process.env.APP_URL ?? 'https://timerx-production.up.railway.app';

function esMismoDiaNatural(a: string, b: Date): boolean {
  return new Date(a).toDateString() === b.toDateString();
}

function cuerpoEmail(nombre: string, dias: FilaFaltante[]): string {
  const lineas = dias
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => `- ${d.fecha}: faltan ${d.falta.toFixed(1).replace('.', ',')} h`)
    .join('\n');
  return (
    `Hola ${nombre},\n\n` +
    `Tienes días laborables sin completar en Horas Grupo:\n\n${lineas}\n\n` +
    `Complétalos aquí: ${APP_URL}\n\n` +
    `Si crees que es un error, habla con tu administrador.`
  );
}

/**
 * Agrupa las filas de faltantes por empleado, aplica la guarda anti-spam
 * (máx. 1 recordatorio por empleado y día natural), y registra el resultado
 * en recordatorio_log -- en ambos modos, log y real, así el mecanismo es
 * verificable sin depender de una bandeja de Resend.
 */
export async function procesarRecordatorios(
  filas: FilaFaltante[],
  modo: 'log' | 'real',
  fechaDesde: string,
  fechaHasta: string
): Promise<ResultadoRecordatorios> {
  const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const porEmpleado = new Map<string, FilaFaltante[]>();
  for (const f of filas) {
    (porEmpleado.get(f.perfilId) ?? porEmpleado.set(f.perfilId, []).get(f.perfilId)!).push(f);
  }

  const ahora = new Date();
  let procesados = 0;
  let omitidos = 0;

  for (const [perfilId, dias] of porEmpleado) {
    const { data: perfil } = await supabaseAdmin.from('perfil').select('nombre, email, ultimo_recordatorio_en').eq('id', perfilId).single();
    if (!perfil) continue;

    if (perfil.ultimo_recordatorio_en && esMismoDiaNatural(perfil.ultimo_recordatorio_en, ahora)) {
      omitidos++;
      continue;
    }

    if (modo === 'real') {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'recordatorios@horasgrupo.app',
        to: perfil.email,
        subject: `Tienes ${dias.length} día${dias.length === 1 ? '' : 's'} sin completar en Horas Grupo`,
        text: cuerpoEmail(perfil.nombre, dias),
      });
    }

    await supabaseAdmin.from('recordatorio_log').insert({
      perfil_id: perfilId,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      dias_faltantes: dias,
      modo,
    });
    await supabaseAdmin.from('perfil').update({ ultimo_recordatorio_en: ahora.toISOString() }).eq('id', perfilId);
    procesados++;
  }

  return { procesados, omitidos };
}
