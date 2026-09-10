import { BottomSheet } from '../compartido/BottomSheet';
import { MapaGrid } from '@/components/mapa/MapaGrid';
import { useMapa } from '@/hooks/useMapa';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export function MapaSheet({ abierto, onCerrar }: Props) {
  const { areas, loading } = useMapa();

  return (
    <BottomSheet abierto={abierto} onCerrar={onCerrar} titulo="Mapa del grupo" crumbs="Toca un elemento para ver qué es">
      {loading ? <p className="text-sm text-ink-tertiary">Cargando…</p> : <MapaGrid areas={areas} variante="stack" />}
    </BottomSheet>
  );
}
