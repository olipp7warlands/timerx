import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { AdminApp } from '@/components/admin/AdminApp';

export default async function AdminPage() {
  const perfil = await getPerfilServer();
  if (!perfil || !['admin_grupo', 'admin_empresa'].includes(perfil.rol)) redirect('/');

  return (
    <AdminApp
      rol={perfil.rol as 'admin_grupo' | 'admin_empresa'}
      empresaId={perfil.empresa_id}
      empresaNombre={perfil.empresa?.nombre ?? ''}
      nombre={perfil.nombre}
      email={perfil.email}
    />
  );
}
