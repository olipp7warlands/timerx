'use client';

import { useEffect, useState } from 'react';
import { ModalCentrado } from '../compartido/ModalCentrado';
import { SelectorRangoFechas, type RangoFechas } from '../compartido/SelectorRangoFechas';
import type { EmpleadoCtx } from '../types';

const TIPOS: { valor: 'vacaciones' | 'baja_medica' | 'otro_permiso'; etiqueta: string }[] = [
  { valor: 'vacaciones', etiqueta: 'Vacaciones' },
  { valor: 'baja_medica', etiqueta: 'Baja médica' },
  { valor: 'otro_permiso', etiqueta: 'Otro permiso' },
];

interface Props {
  ctx: EmpleadoCtx;
  abierto: boolean;
  onCerrar: () => void;
}

/** Formulario directo (tipo + rango real de dos toques) — sin asistente por pasos, eso es solo del layout móvil. */
export function ModalAusencia({ ctx, abierto, onCerrar }: Props) {
  const [tipo, setTipo] = useState<'vacaciones' | 'baja_medica' | 'otro_permiso'>('vacaciones');
  const [rango, setRango] = useState<RangoFechas>({ inicio: null, fin: null });

  useEffect(() => {
    if (abierto) {
      setTipo('vacaciones');
      setRango({ inicio: null, fin: null });
    }
  }, [abierto]);

  async function enviar() {
    if (!rango.inicio) return;
    const exito = await ctx.solicitarAusencia(tipo, rango.inicio, rango.fin ?? rango.inicio);
    if (exito) onCerrar();
  }

  return (
    <ModalCentrado abierto={abierto} onCerrar={onCerrar} titulo="Solicitar ausencia">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="micro mb-1 block">Tipo</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <SelectorRangoFechas dias={ctx.dias} rango={rango} onChange={setRango} />

        <p className="micro">La solicitud queda pendiente de aprobación. Al aprobarse, esos días se bloquean.</p>

        <button type="button" className="btn btn-primary w-full justify-center" onClick={enviar} disabled={!rango.inicio}>
          Solicitar ausencia
        </button>
      </div>
    </ModalCentrado>
  );
}
