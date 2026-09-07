import type { SeccionAdmin } from './types';

export interface GrupoSeccion {
  etiqueta: string;
  items: { id: SeccionAdmin; etiqueta: string }[];
}

/** Los 5 grupos / 11 secciones, réplica exacta del sidebar de panel_administracion.html y del drawer de admin_movil.html. */
export const GRUPOS_SECCIONES: GrupoSeccion[] = [
  { etiqueta: 'General', items: [{ id: 'inicio', etiqueta: 'Inicio' }] },
  {
    etiqueta: 'Personas',
    items: [
      { id: 'usuarios', etiqueta: 'Usuarios' },
      { id: 'ausencias', etiqueta: 'Ausencias' },
    ],
  },
  {
    etiqueta: 'Estructura',
    items: [
      { id: 'empresas', etiqueta: 'Empresas' },
      { id: 'proyectos', etiqueta: 'Proyectos' },
      { id: 'categorias', etiqueta: 'Categorías' },
      { id: 'calendario', etiqueta: 'Calendario' },
    ],
  },
  {
    etiqueta: 'Operación',
    items: [
      { id: 'control', etiqueta: 'Control' },
      { id: 'tarifas', etiqueta: 'Tarifas' },
      { id: 'refacturacion', etiqueta: 'Refacturaciones' },
    ],
  },
  { etiqueta: 'Sistema', items: [{ id: 'ajustes', etiqueta: 'Ajustes' }] },
];

/** Secciones con pantalla propia en móvil (F3 Paso 3); el resto remite a escritorio. */
export const SECCIONES_MOVIL_FUNCIONALES: SeccionAdmin[] = ['inicio', 'ausencias'];
