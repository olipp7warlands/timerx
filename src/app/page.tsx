import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';

export default async function HomePage() {
  const perfil = await getPerfilServer();
  redirect(perfil ? '/debug' : '/login');
}
