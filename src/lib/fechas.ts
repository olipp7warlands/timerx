/**
 * Fechas de negocio ('YYYY-MM-DD') independientes de la zona horaria del proceso.
 *
 * El patrón que esto sustituye era `algunaFecha.toISOString().slice(0, 10)`: `toISOString()` convierte a UTC, así que
 * un `Date` construido en hora LOCAL (medianoche de Madrid = 22:00/23:00 UTC del día anterior) devuelve el día de antes.
 * Efectos reales: el último día del mes salía un día corrido (`new Date(anio, mes, 0)` → "…-29" en vez de "…-30", con lo
 * que `lte('fecha', hasta)` dejaba fuera el último día) y el navegador de días del Inicio admin no avanzaba.
 *
 * Regla: los cálculos de calendario son ARITMÉTICOS (Date.UTC, sin zona) y el "hoy" del negocio es el de Madrid,
 * igual en el navegador y en el servidor (Railway corre en UTC).
 */

const ZONA_NEGOCIO = 'Europe/Madrid';
const FORMATO_MADRID = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Día natural de un instante en hora de Madrid ('YYYY-MM-DD'). */
export function fechaMadrid(instante: Date = new Date()): string {
  return FORMATO_MADRID.format(instante);
}

/** "Hoy" del negocio ('YYYY-MM-DD', hora de Madrid). */
export function hoyMadrid(): string {
  return fechaMadrid();
}

/** Suma (o resta, con negativos) días de calendario a 'YYYY-MM-DD'. Aritmética pura: no depende de la zona ni del horario de verano. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Primer día del mes (`mes` 1..12) como 'YYYY-MM-DD'. */
export function primerDiaMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

/** Último día del mes (`mes` 1..12) como 'YYYY-MM-DD'. */
export function ultimoDiaMes(anio: number, mes: number): string {
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}
