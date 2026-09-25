-- =============================================================================
-- 028: Guarda del ÚLTIMO admin_grupo -- un admin_grupo no puede quitarse (ni quitarle a nadie) el rol si es el ÚNICO
-- admin_grupo activo del grupo.
--
-- Hallazgo (lote v1.2): la ficha de usuario ofrece el cambio de rol a admin_grupo también sobre su PROPIA cuenta, y la BD
-- lo aceptaba: quien es el único admin_grupo podía degradarse por error y dejar al grupo sin nadie que administre
-- roles, empresas ni catálogos (los admin_empresa no pueden nombrar a un admin_grupo, 021). No hay vuelta atrás desde la
-- app: solo un service_role (script de bootstrap) podría restaurarlo.
--
-- Regla (invariante, no «quién lo hace»): tras el UPDATE debe quedar al menos un admin_grupo ACTIVO distinto de la fila que
-- se degrada. Por eso vale para TODOS los llamadores, service_role y migraciones incluidos (a diferencia de la 021, que
-- exenta a la infraestructura: aquí el daño es el mismo lo provoque quien lo provoque, y para un caso legítimo -- cambiar
-- de admin -- basta con nombrar primero al sustituto). Si el único admin_grupo ya está INACTIVO no hay admin operativo que
-- proteger y no se bloquea.
--
-- Por qué un TRIGGER (como la 021): la regla compara OLD y NEW y consulta el resto de la tabla; RLS no puede.
-- SECURITY DEFINER: el recuento debe ver TODOS los perfiles (RLS de perfil recortaría la vista de un no-admin_grupo).
-- El cliente muestra el mismo mensaje sin llegar a la BD (`esUnicoAdminGrupo` en lib/usuarios/permisos.ts).
-- =============================================================================

create or replace function perfil_guardar_ultimo_admin_grupo() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.rol = 'admin_grupo' and new.rol is distinct from old.rol and old.activo
     and not exists (select 1 from perfil p where p.rol = 'admin_grupo' and p.activo and p.id <> old.id) then
    raise exception 'Eres el único admin del grupo — nombra otro antes';
  end if;
  return new;
end;
$$;

create trigger perfil_guardar_ultimo_admin_grupo
  before update of rol on perfil
  for each row execute function perfil_guardar_ultimo_admin_grupo();

revoke execute on function perfil_guardar_ultimo_admin_grupo() from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- AUTOCOMPROBACIÓN
-- -----------------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'perfil_guardar_ultimo_admin_grupo()', 'execute')
     or has_function_privilege('authenticated', 'perfil_guardar_ultimo_admin_grupo()', 'execute') then
    raise exception '028: la función del trigger no debe ser ejecutable directamente';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'perfil_guardar_ultimo_admin_grupo' and tgrelid = 'public.perfil'::regclass and not tgisinternal) then
    raise exception '028: falta el trigger perfil_guardar_ultimo_admin_grupo';
  end if;
end $$;
