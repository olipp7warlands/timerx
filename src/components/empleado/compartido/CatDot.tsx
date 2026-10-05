'use client';

import { useColoresDepartamento } from '@/hooks/useColoresDepartamento';

/** Punto de color del DEPARTAMENTO (el `categoria` que recibe es el nombre del departamento: v2.0). */
export function CatDot({ categoria }: { categoria: string }) {
  const colorDe = useColoresDepartamento();
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colorDe(categoria) }} aria-hidden="true" />;
}
