import { CatDot } from '../compartido/CatDot';
import { Stepper } from '../compartido/Stepper';
import { ComposerLinea } from './ComposerLinea';
import { fmt } from '@/lib/horas/calendario';
import type { EmpleadoCtx } from '../types';

interface Props {
  ctx: EmpleadoCtx;
}

/** Precargado de escritorio: steppers por línea + composer propio "＋ Añadir al lote" + Confirmar (total en vivo) / Descartar. */
export function PrecargadoEscritorio({ ctx }: Props) {
  if (!ctx.staged) return null;
  const total = ctx.staged.lineas.reduce((s, l) => s + l.horas, 0);

  return (
    <div className="card space-y-3 border-dashed p-4">
      <div className="flex items-center justify-between">
        <b className="text-sm">Precargado del {Number(ctx.staged.origen.slice(-2))}</b>
        <span className="mono text-sm">{fmt(total)} h</span>
      </div>
      {ctx.staged.lineas.map((l, i) => (
        <div key={i} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-b-0">
          <span className="flex min-w-0 items-center gap-2">
            <CatDot categoria={l.categoriaNombre} />
            <span className="truncate">
              {l.proyectoNombre} · {l.subcategoriaNombre}
            </span>
          </span>
          <Stepper value={l.horas} max={ctx.maxHorasDia ?? 12} onChange={(h) => ctx.ajustarLineaStaged(i, h)} />
        </div>
      ))}
      <ComposerLinea proyectos={ctx.proyectos} grupos={ctx.grupos} maxHorasDia={ctx.maxHorasDia} etiquetaBoton="＋ Añadir al lote" onAnadir={ctx.anadirLineaStaged} />
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn flex-1 justify-center" onClick={ctx.descartarStaged}>
          Descartar
        </button>
        <button type="button" className="btn btn-primary flex-1 justify-center" onClick={ctx.confirmarStaged}>
          Confirmar {fmt(total)} h
        </button>
      </div>
    </div>
  );
}
