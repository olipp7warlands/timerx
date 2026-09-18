import { ETIQUETA_ESTADO_TICKET, type EstadoTicket } from '@/hooks/useSoporte';

/** Estado sin color (norma del proyecto): relleno = en curso, hueco = abierto, gris = resuelto. La etiqueta siempre acompaña. */
const PUNTO: Record<EstadoTicket, string> = { abierto: 'border border-ink-primary', en_curso: 'bg-ink-primary', resuelto: 'bg-ink-disabled' };

export function PuntoEstadoTicket({ estado }: { estado: EstadoTicket }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-secondary">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${PUNTO[estado]}`} />
      {ETIQUETA_ESTADO_TICKET[estado]}
    </span>
  );
}
