'use client';

interface ModalCentradoProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  ancho?: string;
  children: React.ReactNode;
}

/** Modal centrado de escritorio (scrim+modal), equivalente a BottomSheet para el layout web. */
export function ModalCentrado({ abierto, onCerrar, titulo, ancho = 'min(520px,94vw)', children }: ModalCentradoProps) {
  return (
    <div className={`fixed inset-0 z-40 ${abierto ? '' : 'pointer-events-none'}`} aria-hidden={!abierto}>
      <div onClick={onCerrar} className={`absolute inset-0 bg-black/30 transition-opacity ${abierto ? 'opacity-100' : 'opacity-0'}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{ width: ancho }}
        className={`card absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[opacity,transform] ${
          abierto ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="card-head">
          <h2 className="text-base font-extrabold">{titulo}</h2>
          <button type="button" className="btn btn-text" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}
