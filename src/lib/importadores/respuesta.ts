import { NextResponse } from 'next/server';

/** Respuesta de descarga .xlsx (exports y plantillas comparten cabeceras). */
export function respuestaXlsx(buffer: Buffer, nombreArchivo: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  });
}
