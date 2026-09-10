import {
  IconRejilla,
  IconUsuarios,
  IconAvion,
  IconEmpresa,
  IconCarpeta,
  IconCategoria,
  IconCalendario,
  IconMapa,
  IconControl,
  IconTarifas,
  IconRefacturacion,
  IconAjustes,
  type IconProps,
} from '@/components/ui/icons';
import type { SeccionAdmin } from './types';

export interface GrupoSeccion {
  etiqueta: string;
  items: { id: SeccionAdmin; etiqueta: string; Icono: (props: IconProps) => React.JSX.Element }[];
}

/** Los 5 grupos / 11 secciones, réplica exacta del sidebar de panel_administracion.html y del drawer de admin_movil.html. */
export const GRUPOS_SECCIONES: GrupoSeccion[] = [
  { etiqueta: 'General', items: [{ id: 'inicio', etiqueta: 'Inicio', Icono: IconRejilla }] },
  {
    etiqueta: 'Personas',
    items: [
      { id: 'usuarios', etiqueta: 'Usuarios', Icono: IconUsuarios },
      { id: 'ausencias', etiqueta: 'Ausencias', Icono: IconAvion },
    ],
  },
  {
    etiqueta: 'Estructura',
    items: [
      { id: 'empresas', etiqueta: 'Empresas', Icono: IconEmpresa },
      { id: 'proyectos', etiqueta: 'Proyectos', Icono: IconCarpeta },
      { id: 'categorias', etiqueta: 'Categorías', Icono: IconCategoria },
      { id: 'calendario', etiqueta: 'Calendario', Icono: IconCalendario },
      { id: 'mapa', etiqueta: 'Mapa', Icono: IconMapa },
    ],
  },
  {
    etiqueta: 'Operación',
    items: [
      { id: 'control', etiqueta: 'Control', Icono: IconControl },
      { id: 'tarifas', etiqueta: 'Tarifas', Icono: IconTarifas },
      { id: 'refacturacion', etiqueta: 'Refacturaciones', Icono: IconRefacturacion },
    ],
  },
  { etiqueta: 'Sistema', items: [{ id: 'ajustes', etiqueta: 'Ajustes', Icono: IconAjustes }] },
];

/** Secciones con pantalla propia en móvil (F3 Paso 3); el resto remite a escritorio. */
export const SECCIONES_MOVIL_FUNCIONALES: SeccionAdmin[] = ['inicio', 'ausencias', 'mapa'];
