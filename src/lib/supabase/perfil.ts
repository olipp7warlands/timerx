import { createClient } from './server';

export async function getPerfilServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfil')
    .select('*, empresa(*), departamento(*)')
    .eq('id', user.id)
    .single();

  return perfil;
}
