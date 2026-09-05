import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { ImputacionTester } from './ImputacionTester';

export default async function DebugPage() {
  // Página de verificación interna: nunca accesible en producción (ver PLAN.md F6).
  if (process.env.NODE_ENV === 'production') notFound();

  const perfil = await getPerfilServer();
  if (!perfil) redirect('/login');

  const supabase = await createClient();
  // Sin .eq(empleado_id): si RLS falla, esto mostraría proyectos de otros usuarios.
  const { data: proyectos, error } = await supabase
    .from('empleado_proyecto')
    .select('proyecto_id, desde, hasta, proyecto(id, nombre, empresa(nombre))');

  const hoy = new Date();
  const { data: balanceRows, error: errorBalance } = await supabase.rpc('balance_mes', {
    p_anio: hoy.getFullYear(),
    p_mes: hoy.getMonth() + 1,
  });

  const migracion004 = await readFile(
    path.join(process.cwd(), 'supabase/migrations/004_balance_mes_y_requeridas_efectivas.sql'),
    'utf-8'
  );

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

        <div className="card">
          <div className="card-head">
            <h2>Migración 004 — balance_mes()</h2>
          </div>
          <div className="card-body space-y-3">
            <pre className="mono max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-subtle p-3 text-xs">{migracion004}</pre>
            <div>
              <p className="micro mb-1">Llamada real: balance_mes({hoy.getFullYear()}, {hoy.getMonth() + 1}) para {perfil.nombre}</p>
              {errorBalance && <p className="text-sm text-red-600">{errorBalance.message}</p>}
              {balanceRows?.[0] && (
                <pre className="mono rounded-lg bg-subtle p-3 text-xs">{JSON.stringify(balanceRows[0], null, 2)}</pre>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-extrabold">Paso 1 — capa compartida (hooks + componentes)</h2>
          <ImputacionTester empresaId={perfil.empresa_id} />
        </div>
      </div>
    </main>
  );
}
