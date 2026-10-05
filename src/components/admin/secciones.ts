import {
  IconRejilla,
  IconUsuarios,
  IconAvion,
  IconEmpresa,
  IconCarpeta,
  IconOrganigrama,
  IconCalendario,
  IconMapa,
  IconControl,
  IconSoporte,
  IconTarifas,
  IconRefacturacion,
  IconAjustes,
  type IconProps,
} from '@/components/ui/icons';
import type { SeccionAdmin } from './types';

export interface GrupoSeccion {
  etiqueta: string;
  items: { id: SeccionAdmin; etiqueta: string; Icono: (props: IconProps) => React.JSX.Element; soloAdminGrupo?: boolean }[];
}

/** Los 5 grupos / 12 secciones (Soporte tras Control), réplica exacta del sidebar de panel_administracion.html y del drawer de admin_movil.html. */
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
      { id: 'calendario', etiqueta: 'Calendario', Icono: IconCalendario },
      { id: 'mapa', etiqueta: 'Mapa', Icono: IconMapa },
      // v2.0: Departamentos y Especialidades son UNA sola sección (las especialidades viven dentro de su departamento).
      { id: 'departamentos', etiqueta: 'Departamentos', Icono: IconOrganigrama, soloAdminGrupo: true },
    ],
  },
  {
    etiqueta: 'Operación',
    items: [
      { id: 'control', etiqueta: 'Control', Icono: IconControl },
      { id: 'soporte', etiqueta: 'Soporte', Icono: IconSoporte },
      { id: 'tarifas', etiqueta: 'Tarifas', Icono: IconTarifas },
      { id: 'refacturacion', etiqueta: 'Refacturaciones', Icono: IconRefacturacion },
    ],
  },
  { etiqueta: 'Sistema', items: [{ id: 'ajustes', etiqueta: 'Ajustes', Icono: IconAjustes }] },
];

/** Grupos del menú que ve un rol: `soloAdminGrupo` oculta la sección a admin_empresa (la page además la redirige; la RLS es la barrera real). */
export function gruposVisibles(rol: 'admin_grupo' | 'admin_empresa'): GrupoSeccion[] {
  return GRUPOS_SECCIONES.map((g) => ({ ...g, items: g.items.filter((i) => !i.soloAdminGrupo || rol === 'admin_grupo') }));
}

/** Secciones con pantalla propia en móvil (F3 Paso 3); el resto remite a escritorio. */
export const SECCIONES_MOVIL_FUNCIONALES: SeccionAdmin[] = ['inicio', 'ausencias', 'mapa', 'soporte'];
