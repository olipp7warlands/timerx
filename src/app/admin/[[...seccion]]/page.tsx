import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { AdminApp } from '@/components/admin/AdminApp';
import { BASE_ADMIN, parseRutaAdmin } from '@/lib/nav/rutas';

/**
 * Catch-all opcional del panel: `/admin/<seccion>[/<id>]`, `/admin` -> `/admin/inicio`.
 * Monta siempre el mismo shell; sección y ficha las deriva el cliente de la URL.
 */
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ seccion?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seccion = [] } = await params;

  const perfil = await getPerfilServer();
  if (!perfil) {
    const qs = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString();
    redirect(`/login?next=${encodeURIComponent(`/admin${seccion.length ? `/${seccion.join('/')}` : ''}${qs ? `?${qs}` : ''}`)}`);
  }
  if (!['admin_grupo', 'admin_empresa'].includes(perfil.rol)) redirect('/');

  // Sección desconocida, o sub-segmento en una sección sin fichas -> base del lado.
  if (!parseRutaAdmin(seccion)) redirect(BASE_ADMIN);

  return (
    <AdminApp
      id={perfil.id}
      rol={perfil.rol as 'admin_grupo' | 'admin_empresa'}
      empresaId={perfil.empresa_id}
      empresaNombre={perfil.empresa?.nombre ?? ''}
      nombre={perfil.nombre}
      email={perfil.email}
    />
  );
}
