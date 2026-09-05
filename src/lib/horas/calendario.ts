export interface DiaMes {
  fecha: string; // 'YYYY-MM-DD'
  dow: number; // 0=domingo … 6=sábado
  laborable: boolean;
}

const DOW_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

/** Réplica de es_laborable(): lunes a viernes y no festivo (grupo o de la propia empresa). */
export function construirDiasMes(anio: number, mes: number, fechasFestivo: Set<string>): DiaMes[] {
  const nDias = new Date(anio, mes, 0).getDate();
  const dias: DiaMes[] = [];
  for (let d = 1; d <= nDias; d++) {
    const fecha = toISO(anio, mes, d);
    const dow = new Date(anio, mes - 1, d).getDay();
    const esFinde = dow === 0 || dow === 6;
    dias.push({ fecha, dow, laborable: !esFinde && !fechasFestivo.has(fecha) });
  }
  return dias;
}

export function diaAdyacenteLaborable(dias: DiaMes[], fecha: string, dir: 1 | -1): string | null {
  let i = dias.findIndex((d) => d.fecha === fecha) + dir;
  while (i >= 0 && i < dias.length && !dias[i].laborable) i += dir;
  return i >= 0 && i < dias.length ? dias[i].fecha : null;
}

export function nombreDia(dow: number): string {
  return DOW_NOMBRES[dow];
}

/** Formato es-ES con 1 decimal fijo, coma decimal (mismo criterio que los mocks). */
export function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function rangoDias(inicio: string, fin: string): string {
  const di = new Date(inicio + 'T00:00:00');
  const df = new Date(fin + 'T00:00:00');
  const mismDia = inicio === fin;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (mismDia) return di.toLocaleDateString('es-ES', opts);
  return `${di.toLocaleDateString('es-ES', opts)} – ${df.toLocaleDateString('es-ES', opts)}`;
}

/** Total de horas de un día excluyendo rechazadas (mismo criterio que balance_mes()). */
export function sumaHoras(lineas: { horas: number; estado: string }[]): number {
  return lineas.filter((l) => l.estado !== 'rechazada').reduce((s, l) => s + l.horas, 0);
}

export type EstadoDia = 'completo' | 'incompleto' | 'futuro' | 'no-laborable';

/** Réplica de dotDe(): estado visual del punto del calendario. */
export function estadoDia(fecha: string, laborable: boolean, horasImputadas: number, horasRequeridas: number, hoyISO: string): EstadoDia {
  if (!laborable) return 'no-laborable';
  if (horasImputadas >= horasRequeridas) return 'completo';
  if (fecha <= hoyISO) return 'incompleto';
  return 'futuro';
}
