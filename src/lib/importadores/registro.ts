import type { Importador } from './nucleo';
import type { TipoImportacion } from './tipos';
import { importadorUsuarios } from './usuarios';
import { importadorCoste } from './coste';
import { importadorVacaciones } from './vacaciones';

const IMPORTADORES: Record<TipoImportacion, Importador> = {
  usuarios: importadorUsuarios,
  coste: importadorCoste,
  vacaciones: importadorVacaciones,
};

export function importadorDe(tipo: string): Importador | null {
  return Object.hasOwn(IMPORTADORES, tipo) ? IMPORTADORES[tipo as TipoImportacion] : null;
}
