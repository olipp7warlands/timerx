import { redirect } from 'next/navigation';
import { getPerfilServer } from '@/lib/supabase/perfil';
import { EmpleadoApp } from '@/components/empleado/EmpleadoApp';

/**
 * Solo para verificación visual del Paso 2 en este entorno, donde la pantalla
 * del navegador automatizado está fija a 1536px y no se puede emular un
 * viewport móvil real. Fuerza el ancho a 390px vía CSS -- el componente
 * renderizado es el mismo EmpleadoApp real (mismos hooks, mismos datos), no
 * una versión de prueba distinta. Borrar cuando ya no haga falta.
 */
export default async function DebugMovilPage() {
  const perfil = await getPerfilServer();
  if (!perfil) redirect('/login');

  return (
    <div className="flex min-h-screen justify-center bg-[#333]">
      <div className="w-[390px] overflow-y-auto bg-bg" style={{ height: '844px', transform: 'translateZ(0)' }}>
        <EmpleadoApp
          empresaId={perfil.empresa_id}
          empresaNombre={perfil.empresa?.nombre ?? ''}
          nombre={perfil.nombre}
          forzarLayout="movil"
        />
      </div>
    </div>
  );
}
