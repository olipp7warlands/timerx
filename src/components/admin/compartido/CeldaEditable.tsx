import type { ReactNode } from 'react';

export interface OpcionCelda {
  valor: string;
  etiqueta: string;
}

interface Props {
  /** Si la fila está en el ámbito del admin; fuera de ámbito la celda es un `td` normal (sin title, sin clic). */
  editable: boolean;
  /** Valor actual (id o rol) para preseleccionar. */
  valor: string;
  opciones: OpcionCelda[];
  /** Esta celda está ahora mismo en modo select. */
  abierta: boolean;
  /** ✓ efímero tras guardar. */
  guardada: boolean;
  onAbrir: () => void;
  onCancelar: () => void;
  onElegir: (valor: string) => void;
  /** Presentación en reposo (texto, badge de rol…). */
  children: ReactNode;
}

/**
 * Celda de tabla editable in situ (mock: `.cell-edit`, title "Clic para cambiar"). La clase `cell-edit` es también la marca
 * que usa el guard de la fila (`row-link`) para NO abrir la ficha al editar. Quien la usa decide QUÉ se guarda: la celda solo
 * pinta el select y avisa (`onElegir`); así el guardado sigue pasando por la misma mutación que la ficha.
 */
export function CeldaEditable({ editable, valor, opciones, abierta, guardada, onAbrir, onCancelar, onElegir, children }: Props) {
  const base = 'border-b border-border px-2.5 py-2.5';
  if (!editable) return <td className={base}>{children}</td>;
  return (
    <td className={`${base} cell-edit cursor-pointer`} title="Clic para cambiar" onClick={abierta ? undefined : onAbrir}>
      {abierta ? (
        <select
          className="input w-full"
          autoFocus
          value={valor}
          onChange={(e) => onElegir(e.target.value)}
          onBlur={onCancelar}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancelar();
          }}
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      ) : (
        <>
          {children}
          {guardada && <span className="micro"> ✓</span>}
        </>
      )}
    </td>
  );
}
