-- =============================================================================
-- 007_perfil_select_intragrupo.sql
-- Hallazgo real durante la verificación de la 006 (no una fuga: lo contrario).
--
-- imputacion_select (001, líneas 458-466) ya reconoce el caso intragrupo: un
-- admin_empresa ve imputaciones de empleados de OTRAS empresas cuando esos
-- empleados trabajan en un proyecto de la suya. Pero perfil_select (001,
-- líneas 430-431) nunca recibió la cláusula equivalente -- solo deja ver
-- perfiles de la propia empresa. Confirmado con SQL real (Marina Ortega,
-- admin_empresa Málaga CF): imputacion_base_visible=32 (las líneas de sus 2
-- proyectos trabajadas por empleados de otra empresa SÍ son visibles vía
-- imputacion_select) pero perfiles_de_esos_empleados_visibles=0 -- el JOIN a
-- perfil dentro de v_imputacion_valorada descarta esas 32 filas enteras
-- porque el perfil del empleado es invisible. Efecto: Ficha de proyecto y
-- Refacturación (Paso 2) mostrarían 0h en vez de las horas reales recibidas
-- por intragrupo. Fix: replicar en perfil_select la misma cláusula que ya
-- usa imputacion_select, en vez de reescribir las vistas o compensar en cliente.
-- =============================================================================

alter policy perfil_select on perfil
  using (
    id = auth.uid()
    or es_admin_grupo()
    or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa())
    or (auth_rol() = 'admin_empresa' and exists (
          select 1 from imputacion i
          where i.empleado_id = perfil.id
            and empresa_de_proyecto(i.proyecto_id) = auth_empresa()
        ))
  );
