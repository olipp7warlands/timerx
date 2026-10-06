'use client';

import { CLAVES_COLOR, ETIQUETA_COLOR, colorDeClave } from '@/lib/horas/colores-departamento';
import type { EmpresaOpcion } from '@/hooks/admin/useDepartamentosAdmin';

/** Selector de color: 12 claves de la paleta (el color nunca es el único portador de significado: lleva su nombre). */
export function SelectorColor({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color del departamento">
      {CLAVES_COLOR.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={ETIQUETA_COLOR[c]}
          title={ETIQUETA_COLOR[c]}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full border-2 ${value === c ? 'border-ink-primary' : 'border-transparent'}`}
          style={{ background: colorDeClave(c) }}
        />
      ))}
    </div>
  );
}

/** Casillas de empresa («dónde existe el departamento»). */
export function SelectorEmpresas({ empresas, value, onChange }: { empresas: EmpresaOpcion[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {empresas.map((e) => (
        <label key={e.id} className="flex items-center gap-1.5 text-sm font-bold">
          <input type="checkbox" checked={value.includes(e.id)} onChange={(ev) => onChange(ev.target.checked ? [...value, e.id] : value.filter((x) => x !== e.id))} />
          {e.nombre}
        </label>
      ))}
    </div>
  );
}
