-- =============================================================================
-- 024: decisiones C–L de la matriz de permisos (PLAN.md) — parte SQL. Congelación de seguridad tras esta migración.
--
--   C  imputar_directo: una línea APROBADA no puede nacer saltándose al aprobador de destino. Un admin_empresa solo puede
--      imputar directo cuando el EMPLEADO y el PROYECTO son de SU empresa (origen = destino = la suya); los casos cruzados
--      van por el flujo normal (el empleado computa, el destino aprueba) o por admin_grupo. (Antes el gate miraba solo
--      la empresa del empleado: reproducido con sesión real de Marina, que creó una línea aprobada en un proyecto de Wowinx.)
--   E  departamento: es un catálogo GLOBAL (columnas: id, nombre, responsable_id, activo, created_at; SIN `empresa_id`) y
--      su policy dejaba escribir a CUALQUIER admin_empresa, incluido `responsable_id` (que da lectura y resolución de
--      ausencias de todo un departamento vía `es_responsable_de`). Regla: los catálogos estructurales siguen el mismo ámbito
--      que todo lo demás -> sin ámbito de empresa posible, la escritura es solo admin_grupo (como categoria, ajuste, mapa…).
--   H  Inmutabilidad de las imputaciones `cerrada` (invariante del cierre): trigger BEFORE UPDATE OR DELETE que no deja tocar
--      ni borrar una fila cerrada A NADIE (tampoco service_role/postgres; el UPDATE ya lo frenaba `imputacion_validar`, el
--      DELETE no: admin_grupo podía borrar cerradas). Si algún día hace falta reabrir, será una función explícita de
--      reapertura que hoy NO existe. + privilegios por COLUMNA en `imputacion` para authenticated: el empleado solo escribe lo
--      suyo (INSERT: empleado_id, proyecto_id, subcategoria_id, fecha, horas, descripcion, estado; UPDATE: solo `horas`, que
--      es lo único que hace la app); `aprobado_por`, `aprobado_en`, `motivo_rechazo`, `creada_por` y el cambio de `estado`
--      solo los escriben las RPC (definer) — antes un empleado podía forjarlos en sus propias filas por API.
--   J  perfil_insert_admin: un admin_empresa solo inserta perfiles de rol no-admin de su empresa (hoy inalcanzable —
--      `perfil.id` referencia `auth.users` y todo usuario ya tiene perfil—, pero reproducible con un usuario de auth huérfano:
--      defensa en profundidad, la misma lista blanca que `perfil_update_admin` de la 022).
--   K  Privilegios de tabla: las 21 tablas + 4 vistas + 1 secuencia de `public` eran accesibles para `anon` y `public`
--      (ACL por defecto de Supabase) y protegidas SOLO por RLS (con la anon key: 0 filas, comprobado). Mismo criterio que
--      las 51 funciones de la 023: REVOKE ALL a public/anon sobre TODO, y a authenticated se le concede EXACTAMENTE lo que el
--      modelo necesita (sin TRUNCATE, REFERENCES, TRIGGER ni MAINTAIN, que RLS no cubre; sin DELETE donde no hay policy de
--      DELETE; sin escritura en periodo/ausencia, que solo escriben las RPC). service_role no cambia. ACL por defecto de
--      `postgres` (y `supabase_admin`, si el rol de migración puede) cerrado para tablas, secuencias y funciones nuevas.
--
-- TABLA relación -> privilegios ANTES / DESPUÉS  (S=select I=insert U=update D=delete T=truncate; USAGE para la secuencia)
--   relación                  anon antes   auth antes    anon después  auth después
--   ajuste                    SIUDT        SIUDT         -             SIUD
--   ausencia                  SIUDT        SIUDT         -             SI        (estados por RPC)
--   categoria                 SIUDT        SIUDT         -             SIUD
--   coste_empleado            -            SIUDT         -             SIUD
--   departamento              SIUDT        SIUDT         -             SIUD      (RLS: solo AG escribe, E)
--   empleado_proyecto         SIUDT        SIUDT         -             SIUD
--   empresa                   SIUDT        SIUDT         -             SIUD
--   empresa_jornada           SIUDT        SIUDT         -             SIUD
--   festivo                   SIUDT        SIUDT         -             SIUD
--   imputacion                SIUDT        SIUDT         -             S D + col INSERT(7) + col UPDATE(horas)   (H)
--   mapa_area / mapa_item     SIUDT        SIUDT         -             SIUD
--   perfil                    SIUDT        SIUDT         -             SIU       (sin DELETE: no hay policy)
--   periodo                   SIUDT        SIUDT         -             S         (solo cerrar_periodo escribe)
--   proyecto                  SIUDT        SIUDT         -             SIUD
--   proyecto_responsable      SIUDT        SIUDT         -             SIUD
--   recordatorio_log          SIUDT        SIUDT         -             -         (solo service_role)
--   subcategoria              SIUDT        SIUDT         -             SIUD
--   tarifa                    SIUDT        SIUDT         -             SIUD
--   ticket                    -            S + col       -             S + col INSERT(4) + col UPDATE(estado)  (018, se repone)
--   ticket_comentario         -            S + col       -             S + col INSERT(3)                       (018, se repone)
--   v_ausencia_dias / v_imputacion_valorada / v_refacturacion_mensual / v_coste_vigente
--                             SIUDT (v_coste: -)  SIUDT   -             S         (vistas security_invoker)
--   ticket_ref_seq            SU           SU            -             USAGE     (default de ticket.ref)
--
-- SIN MIGRAR (decisiones del usuario): F (segregación de funciones), G (lecturas de AE más amplias), J-categoría → aceptado-
--   documentado (PLAN.md, docs/seguridad-backlog.md). D e I son solo de aplicación. L es norma de proyecto (PLAN.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. ACL POR DEFECTO: lo que se cree en el futuro nace cerrado
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Objetos creados desde el panel por `supabase_admin`: solo si el rol de migración puede alterarlo (si no, queda a la norma L).
do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated';
  execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated';
  execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from anon';
  execute 'alter default privileges for role supabase_admin revoke execute on functions from public';
exception when insufficient_privilege then
  raise notice '024: el rol de migración no puede alterar el ACL por defecto de supabase_admin (norma de proyecto L: nada se crea desde el panel)';
end $$;

-- -----------------------------------------------------------------------------
-- 1. C: imputar_directo -- un admin_empresa solo si empleado Y proyecto son de su empresa
-- -----------------------------------------------------------------------------
create or replace function imputar_directo(
  p_empleado uuid, p_proyecto uuid, p_subcategoria uuid, p_fecha date,
  p_horas numeric, p_descripcion text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_origen  uuid;
  v_destino uuid;
  v_id      uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if coalesce(auth_rol()::text, '') not in ('admin_grupo', 'admin_empresa') then
    raise exception 'Sin permisos para imputar en nombre de este empleado';
  end if;

  select empresa_id into v_origen from perfil where id = p_empleado;
  if v_origen is null then
    raise exception 'El empleado indicado no existe';
  end if;

  select empresa_id into v_destino from proyecto where id = p_proyecto and activo;
  if v_destino is null then
    raise exception 'El proyecto no existe o no está activo';
  end if;

  -- Una línea aprobada no puede nacer saltándose al aprobador de destino: admin_grupo todo; admin_empresa solo
  -- origen (empleado) = destino (proyecto) = SU empresa. Los casos cruzados van por el flujo normal (computar -> aprueba el destino).
  if not coalesce(es_admin_grupo() or (v_origen = auth_empresa() and v_destino = auth_empresa()), false) then
    raise exception 'Sin permisos: un admin de empresa solo imputa directo cuando el empleado y el proyecto son de su empresa';
  end if;

  insert into imputacion (empleado_id, proyecto_id, subcategoria_id, fecha, horas,
                          descripcion, estado, creada_por, aprobado_por, aprobado_en)
  values (p_empleado, p_proyecto, p_subcategoria, p_fecha, p_horas, p_descripcion,
          'aprobada', auth.uid(), auth.uid(), now())
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. E: departamento (catálogo global) -- escritura solo admin_grupo
-- -----------------------------------------------------------------------------
alter policy departamento_admin on departamento
  using (es_admin_grupo())
  with check (es_admin_grupo());

-- -----------------------------------------------------------------------------
-- 3. J: perfil_insert_admin -- un admin_empresa solo inserta perfiles no-admin de su empresa
-- -----------------------------------------------------------------------------
alter policy perfil_insert_admin on perfil
  with check (
    es_admin_grupo()
    or (auth_rol() = 'admin_empresa'
        and empresa_id = auth_empresa()
        and rol in ('empleado', 'responsable_proyecto'))
  );

-- -----------------------------------------------------------------------------
-- 4. H: imputaciones cerradas inmutables (UPDATE y DELETE, para todos los roles)
-- -----------------------------------------------------------------------------
create or replace function trg_imputacion_cerrada_inmutable() returns trigger
language plpgsql
as $$
begin
  if old.estado = 'cerrada' then
    raise exception 'La imputación % está cerrada: no puede modificarse ni borrarse', old.id using errcode = '23000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger imputacion_cerrada_inmutable
  before update or delete on imputacion
  for each row execute function trg_imputacion_cerrada_inmutable();

revoke execute on function trg_imputacion_cerrada_inmutable() from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. K: privilegios de tabla -- primero cerrar todo, luego conceder exactamente lo que el modelo necesita
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
-- authenticated: se retira TODO y se repone lo necesario (la revocación de tabla retira también los privilegios por columna)
revoke all on all tables    in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

-- Tablas con policies de lectura y escritura (la RLS decide QUIÉN y QUÉ FILAS):
grant select, insert, update, delete on
  ajuste, categoria, coste_empleado, departamento, empleado_proyecto, empresa, empresa_jornada, festivo,
  mapa_area, mapa_item, proyecto, proyecto_responsable, subcategoria, tarifa
  to authenticated;
grant select, insert, update on perfil to authenticated;   -- sin DELETE: no hay policy de borrado
grant select, insert on ausencia to authenticated;         -- las transiciones de estado pasan por RPC
grant select on periodo to authenticated;                  -- solo cerrar_periodo() escribe
-- recordatorio_log: sin privilegios para authenticated (solo service_role)

-- imputacion: el empleado escribe lo suyo por columnas; lo demás, por RPC (H)
grant select, delete on imputacion to authenticated;
grant insert (empleado_id, proyecto_id, subcategoria_id, fecha, horas, descripcion, estado) on imputacion to authenticated;
grant update (horas) on imputacion to authenticated;

-- Soporte (018): se repone exactamente lo que ese archivo concedía
grant select on ticket, ticket_comentario to authenticated;
grant insert (creado_por, titulo, descripcion, tipo) on ticket to authenticated;
grant update (estado) on ticket to authenticated;
grant insert (ticket_id, autor_id, texto) on ticket_comentario to authenticated;

-- Vistas (security_invoker): solo lectura
grant select on v_ausencia_dias, v_imputacion_valorada, v_refacturacion_mensual, v_coste_vigente to authenticated;

-- Secuencia del ref de tickets (default de ticket.ref): basta USAGE
grant usage on sequence ticket_ref_seq to authenticated;

-- -----------------------------------------------------------------------------
-- 6. AUTOCOMPROBACIÓN: si algo no queda como se ha descrito, la migración entera se revierte
-- -----------------------------------------------------------------------------
do $$
declare
  v text;
begin
  -- anon/public: ningún privilegio en ninguna relación ni secuencia de public
  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f')
    and (has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
         or exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                    and (has_column_privilege('anon', c.oid, a.attnum, 'select') or has_column_privilege('anon', c.oid, a.attnum, 'insert') or has_column_privilege('anon', c.oid, a.attnum, 'update'))));
  if v is not null then raise exception '024: anon conserva privilegios en: %', v; end if;

  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S'
    and (has_sequence_privilege('anon', c.oid, 'usage, select, update') or has_sequence_privilege('authenticated', c.oid, 'select, update') or not has_sequence_privilege('authenticated', c.oid, 'usage'));
  if v is not null then raise exception '024: secuencias mal concedidas: %', v; end if;

  -- authenticated: sin TRUNCATE/REFERENCES/TRIGGER en ninguna relación
  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f')
    and has_table_privilege('authenticated', c.oid, 'truncate, references, trigger');
  if v is not null then raise exception '024: authenticated conserva TRUNCATE/REFERENCES/TRIGGER en: %', v; end if;

  -- authenticated conserva lectura donde el modelo la necesita (todo salvo recordatorio_log)
  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v') and c.relname <> 'recordatorio_log'
    and not has_table_privilege('authenticated', c.oid, 'select');
  if v is not null then raise exception '024: authenticated pierde SELECT en: %', v; end if;
  if has_table_privilege('authenticated', 'public.recordatorio_log'::regclass, 'select, insert, update, delete') then
    raise exception '024: authenticated no debe tocar recordatorio_log';
  end if;

  -- imputacion: columnas de aprobación NO escribibles por authenticated; las del empleado, sí
  if has_column_privilege('authenticated', 'public.imputacion'::regclass, 'aprobado_por', 'insert')
     or has_column_privilege('authenticated', 'public.imputacion'::regclass, 'aprobado_por', 'update')
     or has_column_privilege('authenticated', 'public.imputacion'::regclass, 'aprobado_en', 'update')
     or has_column_privilege('authenticated', 'public.imputacion'::regclass, 'motivo_rechazo', 'update')
     or has_column_privilege('authenticated', 'public.imputacion'::regclass, 'creada_por', 'insert')
     or has_column_privilege('authenticated', 'public.imputacion'::regclass, 'estado', 'update') then
    raise exception '024: authenticated puede escribir columnas de aprobación de imputacion';
  end if;
  if not (has_column_privilege('authenticated', 'public.imputacion'::regclass, 'horas', 'update')
          and has_column_privilege('authenticated', 'public.imputacion'::regclass, 'descripcion', 'insert')
          and has_column_privilege('authenticated', 'public.imputacion'::regclass, 'estado', 'insert')) then
    raise exception '024: authenticated pierde columnas que el empleado necesita en imputacion';
  end if;

  -- tickets: se reponen los privilegios por columna de la 018
  if not (has_column_privilege('authenticated', 'public.ticket'::regclass, 'titulo', 'insert')
          and has_column_privilege('authenticated', 'public.ticket'::regclass, 'estado', 'update')
          and has_column_privilege('authenticated', 'public.ticket_comentario'::regclass, 'texto', 'insert'))
     or has_column_privilege('authenticated', 'public.ticket'::regclass, 'ref', 'insert')
     or has_column_privilege('authenticated', 'public.ticket'::regclass, 'titulo', 'update') then
    raise exception '024: privilegios de columna de tickets incorrectos';
  end if;

  -- el trigger de inmutabilidad no es invocable
  if has_function_privilege('authenticated', 'trg_imputacion_cerrada_inmutable()', 'execute')
     or has_function_privilege('anon', 'trg_imputacion_cerrada_inmutable()', 'execute') then
    raise exception '024: trg_imputacion_cerrada_inmutable invocable';
  end if;
end $$;
