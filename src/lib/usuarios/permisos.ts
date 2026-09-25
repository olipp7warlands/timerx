import type { RolUsuario } from '@/lib/auth/roles';

/**
 * Modelo de permisos de las acciones de servidor que operan con service_role (alta de usuarios, restablecer
 * contraseña). Ni RLS ni la guarda de la 021 las cubren: service_role las salta, así que el servidor debe replicar aquí
 * el modelo COMPLETO — ámbito de empresa y límites de rol.
 *
 * Regla (decisión del usuario, coherente con la 021): la asignación de roles admin_* y el control de sus cuentas son
 * territorio de admin_grupo. Un admin_empresa solo actúa sobre cuentas no-admin (lista blanca) de SU empresa.
 */

/** Roles no-admin: los únicos que un admin_empresa puede dar de alta o cuya contraseña puede restablecer. */
export const ROLES_NO_ADMIN: readonly RolUsuario[] = ['empleado', 'responsable_proyecto'];

export function esRolAdmin(rol: RolUsuario): boolean {
  return !ROLES_NO_ADMIN.includes(rol);
}

interface Actor {
  rol: RolUsuario;
  empresa_id: string;
}

/** Error (o null) al dar de alta una cuenta con `input`. Lista blanca de roles: cualquier valor no reconocido se rechaza. */
export function errorAlta(actor: Actor, input: { empresaId: string; rol: string }): string | null {
  if (actor.rol === 'admin_grupo') return null;
  if (actor.rol !== 'admin_empresa') return 'Sin permisos para invitar usuarios';
  if (input.empresaId !== actor.empresa_id) return 'Un admin de empresa solo puede invitar dentro de su propia empresa';
  if (!(ROLES_NO_ADMIN as readonly string[]).includes(input.rol)) {
    return 'Un admin de empresa solo puede dar de alta empleados y responsables de proyecto: los roles de administrador los asigna el admin del grupo';
  }
  return null;
}

/** Error (o null) al restablecer la contraseña de la cuenta `objetivo`. */
export function errorRestablecer(actor: Actor, objetivo: { empresa_id: string; rol: RolUsuario }): string | null {
  if (actor.rol === 'admin_grupo') return null;
  if (actor.rol !== 'admin_empresa') return 'Sin permisos para restablecer contraseñas';
  if (objetivo.empresa_id !== actor.empresa_id) return 'Un admin de empresa solo puede restablecer contraseñas de su propia empresa';
  if (esRolAdmin(objetivo.rol)) return 'Solo el admin del grupo puede restablecer la contraseña de una cuenta de administrador';
  return null;
}

/**
 * ¿Puede `actor` (un admin) administrar -- editar datos, desactivar -- el perfil `objetivo`? Es la regla de la policy
 * `perfil_update_admin` (022) para la UI, que no debe ofrecer lo que la BD va a bloquear en silencio (0 filas):
 * admin_grupo administra todos; admin_empresa, los perfiles NO-admin de su empresa y el suyo propio.
 * (Rol y empresa, además, solo los cambia admin_grupo: trigger de la 021.)
 */
export function puedeAdministrarPerfil(
  actor: { id: string; rol: RolUsuario; empresaId: string },
  objetivo: { id: string; rol: RolUsuario; empresaId: string }
): boolean {
  if (actor.rol === 'admin_grupo') return true;
  if (actor.rol !== 'admin_empresa') return false;
  return objetivo.empresaId === actor.empresaId && (!esRolAdmin(objetivo.rol) || objetivo.id === actor.id);
}

/**
 * ¿Puede `actor` (un admin) imputar directo a un empleado de `empleadoEmpresaId` en un proyecto de `proyectoEmpresaId`?
 * Es la regla de la RPC `imputar_directo` (024): una línea APROBADA no puede nacer saltándose al aprobador de destino.
 * admin_grupo todo; admin_empresa solo si empleado Y proyecto son de SU empresa (los casos cruzados van por el flujo normal:
 * el empleado computa y aprueba el destino). Sin `proyectoEmpresaId` solo se evalúa al empleado (filtro del selector).
 */
export function puedeImputarDirecto(actor: { rol: RolUsuario; empresaId: string }, empleadoEmpresaId: string, proyectoEmpresaId?: string): boolean {
  if (actor.rol === 'admin_grupo') return true;
  if (actor.rol !== 'admin_empresa') return false;
  return empleadoEmpresaId === actor.empresaId && (proyectoEmpresaId === undefined || proyectoEmpresaId === actor.empresaId);
}

/**
 * ¿Es `id` el ÚNICO admin_grupo ACTIVO de la lista? La guarda de la 028 no deja degradarlo (la BD rechaza el cambio de rol con
 * «Eres el único admin del grupo — nombra otro antes»): la UI no ofrece el cambio en vez de dejarlo al error de BD.
 * Solo es fiable para quien ve a todos los perfiles (admin_grupo); para el resto siempre es `false` y no se usa.
 */
export const MENSAJE_UNICO_ADMIN_GRUPO = 'Eres el único admin del grupo — nombra otro antes';
export function esUnicoAdminGrupo(usuarios: { id: string; rol: RolUsuario; activo: boolean }[], id: string): boolean {
  const activos = usuarios.filter((u) => u.rol === 'admin_grupo' && u.activo);
  return activos.length === 1 && activos[0].id === id;
}

/**
 * Error (o null) al DESACTIVAR/REACTIVAR la cuenta `objetivo` (server actions `desactivarUsuario`/`reactivarUsuario`, que además banean
 * o desbanean la cuenta en Auth). Mismos límites que `puedeAdministrarPerfil` (022): admin_grupo cualquiera; admin_empresa solo perfiles
 * NO-admin de su empresa. Nadie desactiva su propia cuenta (un admin se dejaría fuera; el último admin_grupo bloquearía el panel).
 */
export function errorCambiarActivo(
  actor: { id: string; rol: RolUsuario; empresaId: string },
  objetivo: { id: string; rol: RolUsuario; empresaId: string }
): string | null {
  if (actor.rol !== 'admin_grupo' && actor.rol !== 'admin_empresa') return 'Sin permisos para desactivar cuentas';
  if (actor.id === objetivo.id) return 'No puedes desactivar tu propia cuenta';
  if (!puedeAdministrarPerfil(actor, objetivo)) {
    return objetivo.empresaId !== actor.empresaId
      ? 'Un admin de empresa solo puede desactivar cuentas de su propia empresa'
      : 'Solo el admin del grupo puede desactivar o reactivar una cuenta de administrador';
  }
  return null;
}

