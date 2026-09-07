export function OtraSeccionMovil({ titulo }: { titulo: string }) {
  return (
    <div className="card p-4.5">
      <p className="mb-3 font-bold text-ink-secondary">
        La gestión de «{titulo.toLowerCase()}» (altas, ediciones, exports) vive en la versión de escritorio.
      </p>
      <a href="/admin" className="btn">
        Abrir panel de escritorio
      </a>
    </div>
  );
}
