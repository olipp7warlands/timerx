-- =============================================================================
-- 022: `perfil_update_admin` -- un admin_empresa solo administra perfiles NO-admin (cierra la familia)
--
-- PRINCIPIO (decisión del usuario, 2026-09-19; generaliza la 021 y el fix de contraseñas de las server actions):
--   Un admin_empresa administra los perfiles NO-admin (`empleado`, `responsable_proyecto`) de SU empresa.
--   Las cuentas admin_* (`admin_empresa`, `admin_grupo`) solo las administra admin_grupo -- en TODOS los
--   campos, no solo `rol`/`empresa_id`. La única excepción es su PROPIO perfil (ver abajo).
--
-- HALLAZGO (mini-auditoría de la superficie service_role, sesión real de Marina, admin_empresa de Málaga):
--   `perfil_update_admin` (001) deja a un admin_empresa actualizar CUALQUIER columna de CUALQUIER perfil de su
--   empresa. La 021 cerró `rol` y `empresa_id`, pero Marina podía todavía cambiar nombre, `activo`,
--   `max_horas_dia`, departamento y categoría de un admin_grupo (o de otro admin_empresa) que viva en su
--   empresa -- p. ej. desactivar al admin del grupo. Reproducido ANTES de esta migración, rechazado DESPUÉS.
--
-- ELECCIÓN DE HERRAMIENTA: la propia policy (USING + WITH CHECK), no el trigger de la 021.
--   * Son dos preguntas distintas y así el modelo queda legible en dos capas ortogonales:
--       - RLS `perfil_update_admin` = QUÉ FILAS puede actualizar cada rol (ámbito de fila).
--       - Trigger `perfil_guardar_rol_empresa` (021) = QUÉ TRANSICIONES estructurales (rol, empresa) exigen
--         admin_grupo, incluso sobre una fila que sí puede actualizar (necesita OLD vs NEW, que RLS no ve).
--   * "Sobre qué filas" es exactamente lo que expresa USING: cubre de golpe TODAS las columnas presentes y
--     futuras (un trigger habría que dispararlo en cualquier UPDATE y no se entera de columnas nuevas), y
--     compone con la policy existente en un solo predicado, sin una segunda función que mantener.
--   * Contrapartida asumida: una fila fuera de USING no da error, da 0 filas afectadas (como ya pasa con las
--     filas de otra empresa). Por eso la UI no ofrece lo que no puede hacerse (`lib/usuarios/permisos.ts`,
--     `puedeAdministrarPerfil`) y `useUsuarios` trata "0 filas" como error en vez de dar un falso «guardado».
--   * Lista blanca (`rol in ('empleado','responsable_proyecto')`), la misma que `ROLES_NO_ADMIN` en TS: un rol
--     nuevo que se añadiera al enum nacería NO administrable por admin_empresa hasta decidir lo contrario.
--
-- SU PROPIO PERFIL (`id = auth.uid()`): un admin_empresa lo sigue pudiendo actualizar como hasta ahora, con
--   las dos guardas ya vigentes: NO puede cambiar su `rol` ni su `empresa_id` (trigger de la 021). Sí puede
--   tocar su nombre, `email` (columna del perfil, no la cuenta de auth), departamento, categoría,
--   `max_horas_dia` y `activo` (incluso darse de baja lógica: `activo` no bloquea el login, solo deja de contar
--   en faltantes/resúmenes). Se deja así a propósito: no es una escalada y no hay razón para cambiarlo aquí.
--
-- SIN CAMBIOS: admin_grupo (todo), service_role (RLS no le aplica: importadores/alta -- `altaUsuario` actualiza
--   departamento/categoría --, recordatorios -- `ultimo_recordatorio_en` --, scripts), INSERT (`perfil.id`
--   referencia `auth.users`; no hay camino para un admin_empresa) y SELECT (un admin_empresa sigue VIENDO los
--   datos de las cuentas admin_* de su empresa; solo pierde la edición). No hay policy de DELETE.
-- =============================================================================

alter policy perfil_update_admin on perfil
  using (
    es_admin_grupo()
    or (auth_rol() = 'admin_empresa'
        and empresa_id = auth_empresa()
        and (rol in ('empleado', 'responsable_proyecto') or id = auth.uid()))
  )
  with check (
    es_admin_grupo()
    or (auth_rol() = 'admin_empresa'
        and empresa_id = auth_empresa()
        and (rol in ('empleado', 'responsable_proyecto') or id = auth.uid()))
  );
