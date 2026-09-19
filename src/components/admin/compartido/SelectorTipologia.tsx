import type { AreaTipologia } from '@/hooks/admin/useAreasTipologia';

/** Valor especial del selector de PROYECTO: copiar el área de la empresa en el momento de crear (no es una referencia viva). */
export const HEREDAR = 'heredar';
/** Valor del selector para "sin tipología" (area_id NULL). */
export const SIN_TIPOLOGIA = '';

/** Traduce el valor del selector a `area_id`: "heredar" copia el área de la empresa; "" es sin tipología. */
export function areaDeSelector(valor: string, areaDeLaEmpresa: string | null): string | null {
  if (valor === HEREDAR) return areaDeLaEmpresa;
  return valor === SIN_TIPOLOGIA ? null : valor;
}

interface Props {
  value: string;
  onChange: (valor: string) => void;
  areas: AreaTipologia[];
  /** Solo en el alta de proyecto: ofrece "Heredar de la empresa (X)" como primera opción y "Sin tipología" al final (orden del mock). */
  heredarDe?: { areaId: string | null };
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Selector de tipología (áreas activas del mapa). Empresa: "Sin tipología" + áreas. Proyecto: "Heredar de la empresa (X)"
 * + áreas + "Sin tipología". Si el valor apunta a un área que ya no está activa se muestra tal cual, sin perderlo en silencio.
 */
export function SelectorTipologia({ value, onChange, areas, heredarDe, disabled, className = 'input', ariaLabel }: Props) {
  const nombreHeredada = areas.find((a) => a.id === heredarDe?.areaId)?.nombre ?? 'sin tipología';
  const valorHuerfano = value !== HEREDAR && value !== SIN_TIPOLOGIA && !areas.some((a) => a.id === value);
  return (
    <select className={className} value={value} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}>
      {heredarDe ? <option value={HEREDAR}>Heredar de la empresa ({nombreHeredada})</option> : <option value={SIN_TIPOLOGIA}>Sin tipología</option>}
      {areas.map((a) => (
        <option key={a.id} value={a.id}>
          {a.nombre}
        </option>
      ))}
      {valorHuerfano && <option value={value}>Área inactiva</option>}
      {heredarDe && <option value={SIN_TIPOLOGIA}>Sin tipología</option>}
    </select>
  );
}
