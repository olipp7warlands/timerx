-- =============================================================================
-- 008_fix_recursion_perfil_select.sql
-- La 007 introdujo recursión infinita (42P17): perfil_select ahora consulta
-- imputacion en su cláusula intragrupo, pero imputacion_select ya consulta
-- perfil en la suya -- ciclo. auth_rol()/auth_empresa()/empresa_de_proyecto()
-- evitan este problema siendo `security definer` (corren como el propietario
-- de la función, que por ser dueño de la tabla salta su propia RLS, así que
-- nunca reevalúan la policy del origen). Se aplica el mismo patrón aquí: la
-- comprobación se mueve a una función `security definer` dedicada, en vez de
-- un `exists` inline contra una tabla con RLS activa.
-- =============================================================================

create or replace function empleado_trabaja_en_empresa(p_empleado uuid, p_empresa uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from imputacion i
    where i.empleado_id = p_empleado and empresa_de_proyecto(i.proyecto_id) = p_empresa
  )
$$;

alter policy perfil_select on perfil
  using (
    id = auth.uid()
    or es_admin_grupo()
    or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa())
    or (auth_rol() = 'admin_empresa' and empleado_trabaja_en_empresa(perfil.id, auth_empresa()))
  );
