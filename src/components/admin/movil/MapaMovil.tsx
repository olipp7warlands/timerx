import { MapaGrid } from '@/components/mapa/MapaGrid';
import { useMapa } from '@/hooks/useMapa';

export function MapaMovil() {
  const { areas, loading } = useMapa();

  return (
    <div>
      {loading ? <p className="text-sm text-ink-tertiary">Cargando…</p> : <MapaGrid areas={areas} variante="stack" />}
      <p className="micro mt-2.5">La edición de áreas y elementos vive en el panel de escritorio (sección Mapa).</p>
    </div>
  );
}
