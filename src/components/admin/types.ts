export type SeccionAdmin =
  | 'inicio'
  | 'usuarios'
  | 'ausencias'
  | 'empresas'
  | 'proyectos'
  | 'categorias'
  | 'calendario'
  | 'mapa'
  | 'control'
  | 'soporte'
  | 'tarifas'
  | 'refacturacion'
  | 'ajustes';

/** Identidad del admin logueado -- de aquí sale toda la lógica de permisos por sección (PLAN.md 3.1/F3). */
export interface AdminInfo {
  id: string;
  rol: 'admin_grupo' | 'admin_empresa';
  empresaId: string;
  empresaNombre: string;
  nombre: string;
  email: string;
}

