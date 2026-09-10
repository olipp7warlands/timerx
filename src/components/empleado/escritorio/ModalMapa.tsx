import { ModalCentrado } from '../compartido/ModalCentrado';
import { MapaGrid } from '@/components/mapa/MapaGrid';
import { useMapa } from '@/hooks/useMapa';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export function ModalMapa({ abierto, onCerrar }: Props) {
  const { areas, loading } = useMapa();

  return (
    <ModalCentrado abierto={abierto} onCerrar={onCerrar} titulo="Mapa del grupo" ancho="min(920px,94vw)">
      <p className="micro mb-3">Áreas y proyectos del grupo, siempre al día. Toca un elemento para ver qué es y de qué empresa depende.</p>
      {loading ? <p className="text-sm text-ink-tertiary">Cargando…</p> : <MapaGrid areas={areas} variante="grid" />}
    </ModalCentrado>
  );
}
