import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Versión desplegada: commit, rama y fecha de build. EXCEPCIÓN DELIBERADA a «todo requiere sesión»: es público e inocuo
 * (un SHA de git y una fecha, nada de datos, usuarios ni configuración) y lo lee scripts/comprobar-paridad.mjs sin credenciales.
 * El SHA y la rama los inyecta Railway en el build (RAILWAY_GIT_*); la fecha se fija en next.config.ts al construir.
 */
export function GET() {
  return NextResponse.json(
    {
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      rama: process.env.RAILWAY_GIT_BRANCH ?? null,
      build: process.env.BUILD_FECHA ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
