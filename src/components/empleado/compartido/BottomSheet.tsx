'use client';

interface BottomSheetProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  crumbs?: string;
  onVolver?: () => void;
  children: React.ReactNode;
}

/** Hoja inferior móvil (overlay+sheet+grab+head), armazón genérico reutilizado por wizard/histórico/calendario. */
export function BottomSheet({ abierto, onCerrar, titulo, crumbs, onVolver, children }: BottomSheetProps) {
  return (
    <div className={`fixed inset-0 z-40 ${abierto ? '' : 'pointer-events-none'}`} aria-hidden={!abierto}>
      <div
        onClick={onCerrar}
        className={`absolute inset-0 bg-black/30 transition-opacity ${abierto ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`sheet absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-surface p-5 shadow-[0_-8px_30px_rgba(30,30,28,.12)] transition-transform ${
          abierto ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
        <div className="mb-1 flex items-center gap-2">
          {onVolver && (
            <button type="button" className="visible px-2 py-1 text-xl text-ink-secondary" onClick={onVolver} aria-label="Volver">
              ‹
            </button>
          )}
          <h2 className="flex-1 text-lg font-extrabold">{titulo}</h2>
          <button type="button" className="px-1.5 py-1 text-sm text-ink-tertiary" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {crumbs && <p className="micro mb-2 min-h-4">{crumbs}</p>}
        {children}
      </div>
    </div>
  );
}
