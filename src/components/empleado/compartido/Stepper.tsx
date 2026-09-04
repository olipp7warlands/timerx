'use client';

import { fmt } from '@/lib/horas/calendario';

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (siguiente: number) => void;
  size?: 'sm' | 'md';
}

/** Stepper ±paso; una sola pieza cubre las dos variantes visuales de los mocks (tabla/línea vs paso "horas" del wizard) via `size`. */
export function Stepper({ value, min = 0.5, max = 12, step = 0.5, onChange, size = 'sm' }: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const botonClase =
    size === 'sm'
      ? 'grid h-7 w-7 place-items-center rounded-full border border-border-strong text-ink-primary'
      : 'grid h-12 w-12 place-items-center rounded-full border border-border-strong text-lg text-ink-primary';

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={botonClase} onClick={() => onChange(clamp(value - step))} aria-label="Restar media hora">
        −
      </button>
      <span className="mono w-12 text-center">{fmt(value)} h</span>
      <button type="button" className={botonClase} onClick={() => onChange(clamp(value + step))} aria-label="Sumar media hora">
        +
      </button>
    </span>
  );
}
