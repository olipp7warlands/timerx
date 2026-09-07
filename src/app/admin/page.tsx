import { getPerfilServer } from '@/lib/supabase/perfil';

export default async function AdminPage() {
  const perfil = await getPerfilServer();

  return (
    <div className="p-8">
      <h1 className="text-lg font-extrabold">Panel de administración</h1>
      <p className="text-sm text-ink-tertiary">
        Sesión: {perfil?.nombre} ({perfil?.rol})
      </p>
    </div>
  );
}
