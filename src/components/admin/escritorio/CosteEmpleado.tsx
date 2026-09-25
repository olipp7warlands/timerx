'use client';

import { useState } from 'react';
import { hoyMadrid } from '@/lib/fechas';
import { useCosteEmpleado } from '@/hooks/admin/useCosteEmpleado';
import { useToast } from '@/components/empleado/compartido/Toast';

const eurosHora = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h`;
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Coste/hora de la ficha de usuario (dato salarial: SOLO se monta para admin_grupo; ni se consulta para el resto).
 * Muestra el vigente, deja «Registrar coste» (una versión nueva con su fecha «desde», INSERT, nunca update: 016) y enseña las
 * últimas versiones para ver de dónde viene el vigente. Alternativa masiva: Usuarios › Costes (importador).
 */
export function CosteEmpleado({ perfilId }: { perfilId: string }) {
  const { coste, historico, loading, registrar } = useCosteEmpleado(perfilId, true);
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [importe, setImporte] = useState('');
  const [desde, setDesde] = useState(() => hoyMadrid());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setImporte('');
    setDesde(hoyMadrid());
    setError(null);
    setAbierto(true);
  }

  async function guardar() {
    // Coma o punto decimal (como el resto de campos numéricos del panel).
    const valor = Number(importe.trim().replace(',', '.'));
    if (importe.trim() === '' || Number.isNaN(valor)) {
      setError('Indica el importe por hora, por ejemplo 32,50');
      return;
    }
    setGuardando(true);
    const { error: err } = await registrar(valor, desde);
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    setAbierto(false);
    toast(`Coste registrado: ${eurosHora(valor)} desde ${fechaCorta(desde)}`);
  }

  return (
    <div className="mt-1" data-testid="coste-bloque">
      <p className="micro flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="coste-vigente">
        <span>
          Coste/hora vigente: <span className="mono font-extrabold text-ink-primary">{loading ? '…' : coste ? eurosHora(coste.costeHora) : 'sin coste registrado'}</span>
          {coste && <> · desde {fechaCorta(coste.desde)}</>}
        </span>
        {!abierto && (
          <button type="button" className="btn btn-sm" onClick={abrir} data-testid="coste-registrar">
            {coste ? 'Registrar coste' : 'Registrar el primer coste'}
          </button>
        )}
      </p>

      {abierto && (
        <div className="mt-2 rounded-xl border border-border bg-subtle p-3" data-testid="coste-form">
          <div className="flex flex-wrap items-end gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-ink-tertiary" htmlFor="coste-importe">
                Importe (€/h)
              </label>
              <input
                id="coste-importe"
                className="input mono w-[130px]"
                inputMode="decimal"
                autoFocus
                placeholder="32,50"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') guardar();
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-extrabold text-ink-tertiary" htmlFor="coste-desde">
                Desde
              </label>
              <input id="coste-desde" className="input mono" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar coste'}
            </button>
            <button type="button" className="btn btn-sm" disabled={guardando} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-ink-tertiary">
            Se añade como una versión nueva con su fecha: el histórico no se modifica. Si ya hay un coste con esa fecha, elige otra.
          </p>
          {error && (
            <p className="mt-2 text-xs font-bold text-ink-primary" role="alert" data-testid="coste-error">
              ✕ {error}
            </p>
          )}
        </div>
      )}

      {historico.length > 0 && (
        <ul className="micro mt-1.5 space-y-0.5" data-testid="coste-historico" aria-label="Últimas versiones del coste">
          {historico.map((v) => (
            <li key={v.id} className="flex items-center gap-2">
              <span className="mono w-[86px] shrink-0 text-ink-secondary">{fechaCorta(v.desde)}</span>
              <span className="mono font-extrabold text-ink-primary">{eurosHora(v.costeHora)}</span>
              {v.programado ? (
                <span className="mapa-tag">Programado</span>
              ) : coste && v.desde === coste.desde ? (
                <span className="mapa-tag">Vigente</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
