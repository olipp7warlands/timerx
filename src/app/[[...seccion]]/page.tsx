import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { EmpleadoApp } from '@/components/empleado/EmpleadoApp';
import { CuentaDesactivada } from '@/components/ui/CuentaDesactivada';
import { BASE_EMPLEADO, parseRutaEmpleado } from '@/lib/nav/rutas';

/**
 * Catch-all opcional del lado empleado: `/inicio`, `/imputar`, `/calendario`.
 * Monta siempre el mismo shell; la pestaña la deriva el cliente de la URL.
 * Las rutas más específicas (/login, /admin, /api, /debug*, /reset-password,
 * /auth) tienen prioridad sobre este catch-all.
 */
export default async function EmpleadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ seccion?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seccion = [] } = await params;
  // Segmento desconocido (incluida la raíz `/`) -> base del lado.
  if (!parseRutaEmpleado(seccion)) redirect(BASE_EMPLEADO);

  const perfil = await getPerfilServer();
  if (!perfil) {
    const qs = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString();
    redirect(`/login?next=${encodeURIComponent(`/${seccion.join('/')}${qs ? `?${qs}` : ''}`)}`);
  }

  if (perfil.activo === false) return <CuentaDesactivada nombre={perfil.nombre} />;

  return (
    <EmpleadoApp
      empresaId={perfil.empresa_id}
      empresaNombre={perfil.empresa?.nombre ?? ''}
      nombre={perfil.nombre}
      email={perfil.email}
      rol={perfil.rol}
      departamentoId={perfil.departamento_id}
    />
  );
}
