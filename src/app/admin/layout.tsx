import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { CuentaDesactivada } from '@/components/ui/CuentaDesactivada';

const ROLES_ADMIN = ['admin_grupo', 'admin_empresa'];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfilServer();
  // Sin sesión NO se redirige aquí: el layout no conoce la ruta, y la page
  // redirige a /login?next=<ruta> para conservar el enlace profundo.
  if (perfil && perfil.activo === false) return <CuentaDesactivada nombre={perfil.nombre} />;
  if (perfil && !ROLES_ADMIN.includes(perfil.rol)) redirect('/');

  return <>{children}</>;
}
