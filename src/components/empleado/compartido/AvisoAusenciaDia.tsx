import { ETIQUETA_ESTADO_AUSENCIA, ETIQUETA_TIPO_AUSENCIA } from '@/lib/horas/calendario';
import { IconAvion } from '@/components/ui/icons';
import type { Ausencia } from '@/hooks/useAusenciasMes';

/** Chip/banner del día en Imputar cuando cae en una ausencia (pendiente o aprobada). */
export function AvisoAusenciaDia({ ausencia }: { ausencia: Ausencia | undefined }) {
  if (!ausencia) return null;

  return (
    <div className="card flex items-center gap-2.5 bg-subtle p-3.5 px-4 shadow-none">
      <IconAvion />
      <p className="text-sm font-extrabold">
        {ETIQUETA_TIPO_AUSENCIA[ausencia.tipo] ?? ausencia.tipo} · {(ausencia.estado === 'pendiente' ? 'pendiente de aprobación' : ETIQUETA_ESTADO_AUSENCIA[ausencia.estado]?.toLowerCase()) ?? ausencia.estado}
      </p>
    </div>
  );
}
