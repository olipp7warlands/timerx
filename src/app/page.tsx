import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { EmpleadoApp } from '@/components/empleado/EmpleadoApp';

export default async function HomePage() {
  const perfil = await getPerfilServer();
  if (!perfil) redirect('/login');

  return <EmpleadoApp empresaId={perfil.empresa_id} empresaNombre={perfil.empresa?.nombre ?? ''} nombre={perfil.nombre} />;
}
