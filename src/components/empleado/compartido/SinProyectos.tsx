import Link from 'next/link';
import { urlAdmin } from '@/lib/nav/rutas';
import { IconCarpeta } from '@/components/ui/icons';
import type { EmpleadoCtx } from '../types';

/**
 * Estado vacío unificado de "sin proyectos asignados", compartido por las 4 superficies (Inicio/Imputar, web/móvil) --
 * antes era un aviso puntual por-día, repetido y con distinta redacción en 3 sitios (composer de escritorio, precargado,
 * paso del wizard móvil). Aquí es una guía: explica qué hacer y, si quien lo ve puede resolverlo él mismo (admin_empresa/
 * admin_grupo, mismo check que el enlace "Panel admin" del sidebar), lleva directo a su propia ficha para asignarse.
 */
export function SinProyectos({ ctx }: { ctx: EmpleadoCtx }) {
  const esAdmin = ctx.rol === 'admin_empresa' || ctx.rol === 'admin_grupo';
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-subtle text-ink-tertiary">
        <IconCarpeta size={22} />
      </span>
      <div>
        <p className="text-sm font-extrabold">Aún no tienes proyectos asignados</p>
        <p className="micro mt-1">Pide a tu administrador que te asigne al primero.</p>
      </div>
      {esAdmin && (
        <Link href={urlAdmin('usuarios', { fichaId: ctx.usuarioId })} className="btn btn-primary btn-sm">
          Asignar proyectos ›
        </Link>
      )}
    </div>
  );
}
