/** Fecha de hoy (YYYY-MM-DD) en hora de Madrid -- no UTC: entre las 00:00 y las 02:00 locales UTC aún es "ayer". */
export function hoyMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

/** Acepta `YYYY-MM-DD` y `DD/MM/YYYY` (o con `-`). Devuelve ISO o null si no es una fecha REAL (31/02 no lo es). */
export function parseFecha(texto: string): string | null {
  const t = texto.trim();
  let y: number, m: number, d: number;
  let mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else return null;
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;
  return fecha.toISOString().slice(0, 10);
}

export function diasEntre(inicio: string, fin: string): number {
  return Math.round((Date.parse(fin) - Date.parse(inicio)) / 86_400_000);
}

export function formatoFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
