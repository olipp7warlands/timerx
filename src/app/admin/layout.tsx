import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';

const ROLES_ADMIN = ['admin_grupo', 'admin_empresa'];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfilServer();
  if (!perfil || !ROLES_ADMIN.includes(perfil.rol)) redirect('/');

  return <>{children}</>;
}
