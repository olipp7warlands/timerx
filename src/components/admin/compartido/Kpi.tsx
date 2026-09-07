interface KpiProps {
  valor: string;
  unidad?: string;
  etiqueta: string;
  estado?: string;
  puntoLleno?: boolean;
}

/** Réplica de .kpi del mock: valor grande en mono + etiqueta + estado con punto. */
export function Kpi({ valor, unidad, etiqueta, estado, puntoLleno = true }: KpiProps) {
  return (
    <div className="card p-4">
      <p className="mono text-2xl font-extrabold">
        {valor} {unidad && <small className="text-xs font-bold text-ink-tertiary">{unidad}</small>}
      </p>
      <p className="micro mt-1">{etiqueta}</p>
      {estado && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-ink-secondary">
          <span className={`h-[7px] w-[7px] rounded-full ${puntoLleno ? 'bg-ink-primary' : 'border border-ink-primary'}`} />
          {estado}
        </p>
      )}
    </div>
  );
}
