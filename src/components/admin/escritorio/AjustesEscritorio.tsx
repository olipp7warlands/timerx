'use client';

import { useState } from 'react';
import { useAjustes, type Ajustes } from '@/hooks/admin/useAjustes';
import { fmt } from '@/lib/horas/calendario';
import { useToast } from '@/components/empleado/compartido/Toast';
import type { AdminInfo } from '../types';

export function AjustesEscritorio({ info }: { info: AdminInfo }) {
  const { ajustes, actualizar } = useAjustes();
  const toast = useToast();
  const esAdminGrupo = info.rol === 'admin_grupo';
  const [topeInput, setTopeInput] = useState('');
  // Jornada por defecto de empresas nuevas: lo tecleado (`borrador`) o, si no hay, lo guardado.
  const [jornadaBorrador, setJornadaBorrador] = useState<string[] | null>(null);

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

  const jornada = jornadaBorrador ?? ajustes.jornadaDefecto.map((h) => String(h).replace('.', ','));
  const numero = (v: string) => Number(v.trim().replace(',', '.'));
  const totalJornada = jornada.reduce((s, v) => s + (numero(v) || 0), 0);

  async function guardarJornada() {
    const horas = jornada.map(numero);
    if (horas.some((h) => Number.isNaN(h) || h < 0 || h > 24)) {
      toast('Cada día debe tener entre 0 y 24 horas', 'error');
      return;
    }
    const { error } = await actualizar('jornadaDefecto', horas);
    if (error) toast(error, 'error');
    else {
      setJornadaBorrador(null);
      toast('Jornada por defecto actualizada');
    }
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

        <div className="border-b border-border py-3.5" data-testid="ajuste-jornada-defecto">
          <div className="flex items-center justify-between gap-3.5">
            <div>
              <p className="font-extrabold">Jornada por defecto de las empresas nuevas</p>
              <p className="mt-0.5 text-xs font-semibold text-ink-tertiary">
                Horas de lunes a domingo con las que nace cada empresa nueva (formulario o importador). No cambia las empresas ya creadas: su jornada se edita en Calendario. 0 = día no laborable.
              </p>
            </div>
            <span className="mono shrink-0" data-testid="jornada-defecto-total">
              {fmt(totalJornada)} h/sem
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-7 gap-1.5 text-center">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
              <span key={d} className="micro">
                {d}
              </span>
            ))}
            {jornada.map((v, i) => (
              <input
                key={i}
                className="input mono px-0 text-center"
                aria-label={`Horas por defecto del ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]}`}
                value={v}
                disabled={!esAdminGrupo}
                onChange={(e) => setJornadaBorrador(jornada.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </div>
          {esAdminGrupo && (
            <button type="button" className="btn btn-sm mt-2.5" disabled={jornadaBorrador === null} onClick={guardarJornada}>
              Guardar jornada por defecto
            </button>
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
          nombre="Recordatorio por email"
          descripcion="Envío diario a quien tenga días laborables sin completar (últimos 5 días)."
          valor={ajustes.recordatorioEmail}
          editable={esAdminGrupo}
          onToggle={() => toggle('recordatorioEmail', ajustes.recordatorioEmail)}
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
