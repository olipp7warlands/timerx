import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPerfilServer } from '@/lib/supabase/perfil';

export default async function DebugPage() {
  const perfil = await getPerfilServer();
  if (!perfil) redirect('/login');

  const supabase = await createClient();
  // Sin .eq(empleado_id): si RLS falla, esto mostraría proyectos de otros usuarios.
  const { data: proyectos, error } = await supabase
    .from('empleado_proyecto')
    .select('proyecto_id, desde, hasta, proyecto(id, nombre, empresa(nombre))');

  return (
    <main className="min-h-screen bg-bg p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card">
          <div className="card-head">
            <h2>Perfil</h2>
          </div>
          <div className="card-body space-y-1 text-sm">
            <p><span className="micro">Nombre</span> {perfil.nombre}</p>
            <p><span className="micro">Email</span> {perfil.email}</p>
            <p><span className="micro">Rol</span> {perfil.rol}</p>
            <p><span className="micro">Empresa</span> {perfil.empresa?.nombre ?? '—'}</p>
            <p><span className="micro">Departamento</span> {perfil.departamento?.nombre ?? '—'}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Proyectos asignados (vía RLS: ep_select)</h2>
          </div>
          <div className="card-body">
            {error && <p className="text-sm text-red-600">{error.message}</p>}
            {!error && (!proyectos || proyectos.length === 0) && (
              <p className="text-sm text-ink-tertiary">Sin proyectos asignados.</p>
            )}
            <ul className="space-y-2 text-sm">
              {proyectos?.map((ep: any) => (
                <li key={ep.proyecto_id} className="flex justify-between">
                  <span>{ep.proyecto?.nombre}</span>
                  <span className="mono text-ink-tertiary">{ep.proyecto?.empresa?.nombre}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
