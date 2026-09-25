/**
 * Punto de «hay novedad» (sin número). Mismo lenguaje que los puntos de estado del sistema: relleno `accent`, sin color
 * de marca. El nombre accesible lo lleva quien lo usa (`etiqueta`); `title` da la pista al pasar el ratón.
 */
export function PuntoNovedad({ etiqueta = 'Novedades en tus tickets', className = '', testId }: { etiqueta?: string; className?: string; testId?: string }) {
  return (
    <span
      role="status"
      aria-label={etiqueta}
      title={etiqueta}
      data-testid={testId}
      className={`inline-block h-2 w-2 shrink-0 rounded-full bg-accent ring-2 ring-surface ${className}`}
    />
  );
}
