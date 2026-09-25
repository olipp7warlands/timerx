/** Tipos compartidos servidor/cliente del patrón común de importadores (sin dependencias de servidor). */

export type TipoImportacion = 'usuarios' | 'coste' | 'vacaciones' | 'empresas' | 'proyectos' | 'categorias';

export interface ErrorFila {
  /** Número de fila TAL COMO LA VE EL USUARIO en Excel (la 1 es la cabecera). */
  fila: number;
  motivo: string;
}

export type InformeImportacion =
  | {
      ok: true;
      totalFilas: number;
      validas: number;
      errores: ErrorFila[];
      /** Solo tras `ejecutarImportacion`: filas realmente dadas de alta. Con errores es siempre 0 (todo-o-nada). */
      importadas?: number;
    }
  | { ok: false; error: string };
