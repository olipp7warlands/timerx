import type { Importador } from './nucleo';
import type { TipoImportacion } from './tipos';
import { importadorUsuarios } from './usuarios';
import { importadorCoste } from './coste';
import { importadorVacaciones } from './vacaciones';
import { importadorEmpresas } from './empresas';
import { importadorProyectos } from './proyectos';
import { importadorCategorias } from './categorias';

const IMPORTADORES: Record<TipoImportacion, Importador> = {
  usuarios: importadorUsuarios,
  coste: importadorCoste,
  vacaciones: importadorVacaciones,
  empresas: importadorEmpresas,
  proyectos: importadorProyectos,
  categorias: importadorCategorias,
};

export function importadorDe(tipo: string): Importador | null {
  return Object.hasOwn(IMPORTADORES, tipo) ? IMPORTADORES[tipo as TipoImportacion] : null;
}
