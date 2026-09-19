-- =============================================================================
-- 025: una cuenta DESACTIVADA (`perfil.activo = false`) deja de servir en la API de datos en el acto (I-residual)
--
-- PROBLEMA (medido): el ban de Auth (`ban_duration`) corta el login, el refresco de sesión y GoTrue, pero un JWT YA EMITIDO sigue
--   sirviendo datos en PostgREST (200 con filas) hasta que caduca (hasta 1 h): PostgREST solo verifica firma y expiración.
--   La 024 bloqueaba la APLICACIÓN (páginas y acciones de servidor) pero no la API de datos.
--
-- SOLUCIÓN: un PRE-REQUEST de PostgREST (`pgrst.db_pre_request`): una función que PostgREST ejecuta antes de CADA petición, con el rol
--   de la petición. Si el JWT es de una cuenta desactivada, lanza `PT403 «Cuenta desactivada»` (HTTP 403) y la petición muere ahí. Es un
--   único punto que cubre tablas, vistas y RPC —presentes y futuras— sin tocar policies ni funciones. Junto con el ban de Auth
--   (server action `desactivarUsuario`) el corte es inmediato y sin ventana: ban = no hay tokens nuevos; pre-request = los vigentes no sirven.
--
-- EXCEPCIÓN A LA NORMA L (documentada): PostgREST ejecuta el pre-request con el rol de la petición, así que esta función NECESITA
--   EXECUTE para anon, authenticated y service_role. Es la ÚNICA función de `public` ejecutable por anon (no lee ni escribe nada: devuelve
--   void y solo lanza si el JWT es de una cuenta desactivada). Las consultas de verificación del runbook la excluyen por nombre.
--
-- ROLLBACK (si algún día hiciera falta): `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`
--   (el CLI conecta directo a la BD, no por PostgREST, así que se puede aplicar aunque la API fallara).
-- =============================================================================

create or replace function cuenta_desactivada_pre_request() returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and exists (select 1 from perfil where id = auth.uid() and not activo) then
    raise exception 'Cuenta desactivada' using errcode = 'PT403', hint = 'Habla con tu administrador';
  end if;
end;
$$;

revoke all on function cuenta_desactivada_pre_request() from public;
grant execute on function cuenta_desactivada_pre_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.cuenta_desactivada_pre_request';
notify pgrst, 'reload config';

-- AUTOCOMPROBACIÓN: la función del pre-request es la única ejecutable por anon, y la config quedó fijada
do $$
declare v text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname <> 'cuenta_desactivada_pre_request' and has_function_privilege('anon', p.oid, 'execute');
  if v is not null then raise exception '025: anon ejecuta funciones no previstas: %', v; end if;

  if not exists (select 1 from pg_db_role_setting s join pg_roles ro on ro.oid = s.setrole, unnest(s.setconfig) c
                 where ro.rolname = 'authenticator' and c = 'pgrst.db_pre_request=public.cuenta_desactivada_pre_request') then
    raise exception '025: pgrst.db_pre_request no quedó fijado';
  end if;
end $$;
