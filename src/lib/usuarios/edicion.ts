import type { RolUsuario } from '@/lib/auth/roles';

/** Campos de perfil editables desde la ficha o desde la tabla (misma mutación: `useUsuarios.actualizar`). */
export interface CamposPerfil {
  empresaId: string;
  departamentoId: string | null;
  categoriaId: string | null;
  rol: RolUsuario;
}

export interface CambiosPerfil {
  empresaId?: string;
  departamentoId?: string | null;
  categoriaId?: string | null;
  rol?: RolUsuario;
}

/**
 * Diferencia entre lo que hay y lo que el formulario de la ficha propone: SOLO los campos cambiados (como la edición inline,
 * que ya mandaba un único campo). Un formulario completo que reenviaba todo pisaba lo que otro admin hubiera cambiado
 * entretanto en un campo que ni se tocó (lección 2) y hacía que un campo rechazado (rol, empresa) tumbara el guardado del
 * resto. `puedeEmpresaRol`: empresa y rol solo los cambia admin_grupo (trigger de la 021); para el resto nunca se envían.
 */
export function cambiosDePerfil(actual: CamposPerfil, propuesto: CamposPerfil, puedeEmpresaRol: boolean): CambiosPerfil {
  const cambios: CambiosPerfil = {};
  if (puedeEmpresaRol && propuesto.empresaId !== actual.empresaId) cambios.empresaId = propuesto.empresaId;
  if (propuesto.departamentoId !== actual.departamentoId) cambios.departamentoId = propuesto.departamentoId;
  if (propuesto.categoriaId !== actual.categoriaId) cambios.categoriaId = propuesto.categoriaId;
  if (puedeEmpresaRol && propuesto.rol !== actual.rol) cambios.rol = propuesto.rol;
  return cambios;
}
