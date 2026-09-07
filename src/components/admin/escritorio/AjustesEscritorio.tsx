'use client';

import { useState } from 'react';
import { useAjustes, type Ajustes } from '@/hooks/admin/useAjustes';
import { useToast } from '@/components/empleado/compartido/Toast';
import type { AdminInfo } from '../types';

export function AjustesEscritorio({ info }: { info: AdminInfo }) {
  const { ajustes, actualizar } = useAjustes();
  const toast = useToast();
  const esAdminGrupo = info.rol === 'admin_grupo';
  const [topeInput, setTopeInput] = useState('');

  if (!ajustes) return <p className="text-sm text-ink-tertiary">Cargando…</p>;

  async function toggle(clave: keyof Ajustes, valorActual: boolean) {
    const { error } = await actualizar(clave, !valorActual);
    if (error) toast(error, 'error');
  }

  async function guardarTope() {
    const horas = Number(topeInput.replace(',', '.'));
    if (!horas || horas <= 0) {
      toast('Introduce un número de horas válido', 'error');
      return;
    }
    const { error } = await actualizar('topeHorasDia', horas);
    if (error) toast(error, 'error');
    else toast('Tope de horas actualizado');
  }

  return (
    <div className="card max-w-[660px]">
      <div className="card-head">
        <h2 className="text-sm font-extrabold">Ajustes globales</h2>
      </div>
      <div className="card-body">
        <div className="flex items-center justify-between gap-3.5 border-b border-border py-3.5">
          <div>
            <p className="font-extrabold">Tope de horas al día</p>
            <p className="mt-0.5 text-xs font-semibold text-ink-tertiary">Máximo imputable por persona y día, sumando todas las líneas.</p>
          </div>
          {esAdminGrupo ? (
            <div className="flex items-center gap-2">
              <input className="input mono w-[84px] text-center" placeholder={String(ajustes.topeHorasDia)} value={topeInput} onChange={(e) => setTopeInput(e.target.value)} />
              <button type="button" className="btn btn-sm" onClick={guardarTope}>
                Guardar
              </button>
            </div>
          ) : (
            <span className="mono">{ajustes.topeHorasDia}</span>
          )}
        </div>

        <Ajuste
          nombre="Descripción obligatoria"
          descripcion="Exige un texto al imputar horas."
          valor={ajustes.descripcionObligatoria}
          editable={esAdminGrupo}
          onToggle={() => toggle('descripcionObligatoria', ajustes.descripcionObligatoria)}
        />
        <Ajuste
          nombre="Bloquear meses cerrados"
          descripcion="Impide cualquier cambio en periodos ya cerrados."
          valor={ajustes.bloquearMesesCerrados}
          editable={esAdminGrupo}
          onToggle={() => toggle('bloquearMesesCerrados', ajustes.bloquearMesesCerrados)}
        />
        <Ajuste
          nombre="Recordatorio por email"
          descripcion="Envía un aviso a quien tenga imputaciones pendientes (F6, pendiente de activar)."
          valor={ajustes.recordatorioEmail}
          editable={false}
          onToggle={() => {}}
        />
      </div>
    </div>
  );
}

function Ajuste({
  nombre,
  descripcion,
  valor,
  editable,
  onToggle,
}: {
  nombre: string;
  descripcion: string;
  valor: boolean;
  editable: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5 border-b border-border py-3.5 last:border-b-0">
      <div>
        <p className="font-extrabold">{nombre}</p>
        <p className="mt-0.5 text-xs font-semibold text-ink-tertiary">{descripcion}</p>
      </div>
      <button
        type="button"
        disabled={!editable}
        onClick={onToggle}
        className={`relative h-[21px] w-9 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${valor ? 'border-accent bg-accent' : 'border-border-strong bg-subtle'}`}
      >
        <span className={`absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all ${valor ? 'left-[17px] bg-on-accent' : 'left-0.5 bg-ink-disabled'}`} />
      </button>
    </div>
  );
}
