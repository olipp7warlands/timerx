-- =============================================================================
-- 023: (A) superficie COMPLETA de funciones: REVOKE EXECUTE a public/anon + guardas null-safe
--      (B) `handle_new_user` deja de confiar en los metadatos del cliente (el rol nace SIEMPRE 'empleado')
--
-- HALLAZGOS (matriz de permisos, PLAN.md; verificados con sondas inocuas ANTES de esta migración):
--   A. Las guardas de `cerrar_periodo` e `imputar_directo` (`if not (es_admin_grupo() or …)`) evalúan a NULL con `anon`
--      (auth_rol() es null sin sesión) y `if null` NO lanza: la guarda no frenaba a nadie sin sesión. Y 47 de las 51
--      funciones de `public` conservaban EXECUTE para anon/public (default de Postgres + `alter default privileges` de
--      Supabase). Con la anon key -pública en el bundle- se podían cerrar meses o insertar imputaciones aprobadas.
--   B. `handle_new_user` copiaba `rol` (y `empresa_id`) de `raw_user_meta_data`; con el registro público abierto
--      (`disable_signup:false`) cualquiera podía nacer admin_grupo. El registro ya se cerró en la config de Auth
--      (`supabase/config.toml` -> `enable_signup = false`, aplicado con `config push`); esta migración quita además la
--      confianza en los metadatos, por si algún día vuelve a abrirse.
--
-- DEFENSA EN PROFUNDIDAD (dos capas independientes, cada una suficiente por sí sola):
--   1. GRANTS: nada de EXECUTE para public/anon; authenticated solo en lo invocable; los triggers, para nadie
--      (Postgres comprueba EXECUTE al CREAR el trigger, no al dispararlo); lo de servidor, solo service_role.
--   2. GUARDAS que viajan con la función: en toda función CON EFECTOS, `auth.uid() is null` lanza SIEMPRE (42501), y los
--      gates de rol son null-safe (`coalesce(…, false)`). Si un REVOKE se pierde en una migración futura, la función
--      sigue rechazando una llamada sin sesión. (service_role tampoco tiene uid: los flujos legítimos con efectos usan
--      la sesión de un admin; las dos funciones solo-servidor llevan su propia guarda por rol del JWT.)
--   Además: el ACL POR DEFECTO para funciones nuevas creadas por `postgres` deja de conceder EXECUTE a anon/public: una
--   función futura nace cerrada y hay que abrirla con un GRANT explícito (falla en cerrado, no en abierto).
--   La migración termina con una AUTOCOMPROBACIÓN: si tras ella anon conservara EXECUTE en algo, o authenticated
--   perdiera una función invocable, aborta y no se aplica nada.
--
-- ¿NECESITA ANON ALGUNA FUNCIÓN? NO, ninguna. Todas las policies son `to authenticated`; el login usa la API de Auth,
--   no funciones nuestras; no hay páginas públicas con datos. Excepciones concedidas a anon: 0.
--
-- FUNCIÓN -> GRANTS ANTES/DESPUÉS -> GUARDA        (A=anon U=authenticated S=service_role; '-' = sin EXECUTE)
--   Categorías: E = RPC con efectos · R = RPC de lectura (definer) · H = helper definer de RLS/RPC · I = helper puro/invoker
--               S = solo servidor · T = función de trigger
--   Los `antes` salen del catálogo vivo (has_function_privilege) tomado justo antes de esta migración.
--
--   función                                              cat  antes   después  guarda
--   admin_puede_ver_empresa(uuid)                        I    A U S   - U S    sin efectos; null sin sesión
--   aprobar_ausencia(uuid)                               E    A U S   - U S    uid null -> 42501; puede_resolver_ausencia null-safe
--   aprobar_imputaciones(uuid[])                         E    A U S   - U S    uid null -> 42501; rol admin null-safe
--   auth_empresa()                                       H    A U S   - U S    sin efectos; null sin sesión
--   auth_rol()                                           H    A U S   - U S    sin efectos; null sin sesión
--   balance_mes(integer,integer)                         R    A U S   - U S    sin efectos; solo la propia persona (uid)
--   balance_mes_empleado(uuid,integer,integer)           R    A U S   - U S    sin efectos; gate admin_puede_ver_empresa (vacío sin sesión)
--   cancelar_ausencia(uuid)                              E    A U S   - U S    uid null -> 42501; solo propias pendientes
--   cerrar_periodo(uuid,integer,integer)                 E    A U S   - U S    uid null -> 42501; gate admin/empresa null-safe (ERA el hueco A)
--   descripcion_obligatoria()                            I    A U S   - U S    sin efectos
--   dias_ausencia_en_mes(date,date,uuid,int,int)         I    A U S   - U S    sin efectos
--   empleado_trabaja_en_empresa(uuid,uuid)               H    A U S   - U S    sin efectos
--   empresa_de_perfil(uuid)                              H    A U S   - U S    sin efectos
--   empresa_de_proyecto(uuid)                            H    A U S   - U S    sin efectos
--   enviar_imputaciones(uuid[])                          E    A U S   - U S    uid null -> 42501; solo filas propias
--   es_admin_grupo()                                     I    A U S   - U S    sin efectos; null sin sesión
--   es_festivo(date,uuid)                                I    A U S   - U S    sin efectos
--   es_laborable(date,uuid)                              I    A U S   - U S    sin efectos
--   es_responsable_de(uuid)                              H    A U S   - U S    sin efectos
--   estado_dias_mes(integer,integer)                     R    A U S   - U S    sin efectos; gate admin_puede_ver_empresa
--   faltantes(date,date)                                 R    A U S   - U S    sin efectos; gate por WHERE (vacío sin sesión)
--   faltantes_recordatorio(date,date)                    S    - - S   - - S    sin efectos; SOLO devuelve filas si el rol del JWT es service_role
--   fte_mes(integer,integer)                             R    A U S   - U S    sin efectos; gate admin_puede_ver_empresa
--   handle_new_user()                                    T    A U S   - - -    trigger; rol SIEMPRE 'empleado' (B)
--   horas_ausencia_en_mes(date,date,uuid,int,int)        I    A U S   - U S    sin efectos
--   horas_requeridas(date,date,uuid)                     I    A U S   - U S    sin efectos
--   horas_requeridas_mes(integer,integer,uuid)           I    A U S   - U S    sin efectos
--   importar_ausencias(jsonb)                            E    - U S   - U S    uid null -> 42501; solo admin_grupo null-safe
--   imputacion_validar()                                 T    A U S   - - -    trigger
--   imputar_directo(uuid,uuid,uuid,date,numeric,text)    E    A U S   - U S    uid null -> 42501; admin_puede_ver_empresa null-safe (ERA el hueco A)
--   jornada_del_dia(uuid,date)                           I    A U S   - U S    sin efectos
--   jornada_dias_mes(integer,integer,uuid)               I    A U S   - U S    sin efectos
--   jornada_horas()                                      I    A U S   - U S    sin efectos
--   perfil_guardar_rol_empresa()                         T    A U S   - - -    trigger (021)
--   periodo_cerrado(uuid,date)                           I    A U S   - U S    sin efectos
--   puede_resolver_ausencia(uuid)                        H    A U S   - U S    sin efectos
--   puede_ver_ticket(uuid)                               H    A U S   - U S    sin efectos
--   rechazar_ausencia(uuid,text)                         E    A U S   - U S    uid null -> 42501; puede_resolver_ausencia null-safe
--   rechazar_imputaciones(uuid[],text)                   E    A U S   - U S    uid null -> 42501; rol admin null-safe
--   requeridas_efectivas(integer,integer)                R    A U S   - U S    sin efectos; gate admin/propio
--   resolver_tarifa(uuid,uuid,uuid,date)                 I    A U S   - U S    sin efectos
--   resumen_dia(date)                                    R    A U S   - U S    sin efectos; gate admin_puede_ver_empresa (ceros sin sesión)
--   resumen_mes(integer,integer)                         R    A U S   - U S    sin efectos; gate admin_puede_ver_empresa
--   solicitar_ausencia(tipo_ausencia,date,date,text)     E    A U S   - U S    uid null -> 42501
--   ticket_hilo(uuid)                                    R    - U S   - U S    sin efectos; puede_ver_ticket
--   ticket_ref_resincronizar()                           S    - - S   - - S    CON efectos (setval): rol del JWT ≠ service_role -> 42501
--   tiene_ausencia_aprobada(uuid,date)                   I    A U S   - U S    sin efectos
--   trg_ausencia_validar()                               T    A U S   - - -    trigger
--   trg_empresa_jornada_defecto()                        T    A U S   - - -    trigger
--   trg_imputacion_sin_ausencia()                        T    A U S   - - -    trigger
--   trg_ticket_comentario_respuesta()                    T    A U S   - - -    trigger
--
-- B. OTROS CAMPOS COPIADOS DE LOS METADATOS por `handle_new_user` (001:485), con el mismo criterio:
--   * rol        -> YA NO se copia: siempre 'empleado'. Los flujos de admin asignan el rol DESPUÉS con service_role
--                   (`altaUsuario` en `lib/usuarios/alta.ts`; `scripts/seed-usuarios.mjs`), por vías ya protegidas
--                   (`errorAlta`, guardas de la 021/022). Si esa asignación falla, la cuenta queda como 'empleado'
--                   (mínimo privilegio) y el error se informa.
--   * empresa_id -> SE SIGUE copiando (NOT NULL; el perfil no puede nacer sin empresa) y no se puede mover a otro sitio: la
--                   invitación por email (`inviteUserByEmail`) solo admite `user_metadata`. VEREDICTO: aceptado-documentado.
--                   Con el registro cerrado solo el Admin API (service_role) crea cuentas, y un valor manipulado solo
--                   colocaría a un `empleado` en una empresa existente (la FK lo valida): sin asignaciones no puede imputar
--                   (`imputacion_validar`), y como empleado solo ve lo propio. Riesgo residual solo si el registro se
--                   reabriera -> verificación obligatoria del runbook (`docs/runbook-produccion.md`, sección 5).
--   * nombre     -> se copia; solo presentación (sin efecto en permisos).
--   * email      -> viene de `auth.users.email`, no de los metadatos.
--   Ningún código ni SQL usa `user_metadata.rol` para autorizar (auditado: solo los caminos de alta lo escriben).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. B: handle_new_user -- el rol NUNCA viene del cliente
-- -----------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Rol SIEMPRE 'empleado' al nacer: los metadatos los puede escribir quien crea la cuenta (o un registro público mal
  -- configurado). El rol lo asigna después un admin por sus vías protegidas.
  insert into perfil (id, empresa_id, nombre, email, rol)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'empresa_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    new.email,
    'empleado'
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. A: funciones CON EFECTOS -- misma lógica que la versión viva + guarda `auth.uid() is null` + gates null-safe
-- -----------------------------------------------------------------------------
create or replace function enviar_imputaciones(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;

  update imputacion
     set estado = 'enviada'
   where id = any(p_ids)
     and empleado_id = auth.uid()
     and estado in ('borrador', 'rechazada');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function aprobar_imputaciones(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if coalesce(auth_rol()::text, '') not in ('admin_grupo', 'admin_empresa') then
    raise exception 'Sin permisos para aprobar';
  end if;

  update imputacion i
     set estado = 'aprobada', aprobado_por = auth.uid(), aprobado_en = now(), motivo_rechazo = null
   where i.id = any(p_ids)
     and i.estado = 'enviada'
     and (es_admin_grupo() or empresa_de_proyecto(i.proyecto_id) = auth_empresa());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function rechazar_imputaciones(p_ids uuid[], p_motivo text) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if coalesce(auth_rol()::text, '') not in ('admin_grupo', 'admin_empresa') then
    raise exception 'Sin permisos para rechazar';
  end if;

  update imputacion i
     set estado = 'rechazada', motivo_rechazo = p_motivo, aprobado_por = auth.uid(), aprobado_en = now()
   where i.id = any(p_ids)
     and i.estado = 'enviada'
     and (es_admin_grupo() or empresa_de_proyecto(i.proyecto_id) = auth_empresa());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function imputar_directo(
  p_empleado uuid, p_proyecto uuid, p_subcategoria uuid, p_fecha date,
  p_horas numeric, p_descripcion text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_empresa uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;

  select empresa_id into v_empresa from perfil where id = p_empleado;
  if v_empresa is null then
    raise exception 'El empleado indicado no existe';
  end if;

  -- null-safe: sin sesión (o sin perfil) admin_puede_ver_empresa() es null y `not null` NO lanzaba (hallazgo A).
  if not coalesce(admin_puede_ver_empresa(v_empresa), false) then
    raise exception 'Sin permisos para imputar en nombre de este empleado';
  end if;

  insert into imputacion (empleado_id, proyecto_id, subcategoria_id, fecha, horas,
                          descripcion, estado, creada_por, aprobado_por, aprobado_en)
  values (p_empleado, p_proyecto, p_subcategoria, p_fecha, p_horas, p_descripcion,
          'aprobada', auth.uid(), auth.uid(), now())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function cerrar_periodo(p_empresa uuid, p_anio int, p_mes int) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pendientes int;
  v_sin_tarifa numeric;
  v_detalle    text;
  v_partes     text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;

  -- null-safe: sin sesión la expresión era NULL y `not null` NO lanzaba (hallazgo A).
  if not coalesce(es_admin_grupo() or (auth_rol() = 'admin_empresa' and auth_empresa() = p_empresa), false) then
    raise exception 'Sin permisos para cerrar el periodo';
  end if;

  select count(*) into v_pendientes
  from imputacion i join proyecto p on p.id = i.proyecto_id
  where p.empresa_id = p_empresa
    and extract(year from i.fecha) = p_anio and extract(month from i.fecha) = p_mes
    and i.estado in ('borrador', 'enviada');

  select coalesce(sum(i.horas), 0)
    into v_sin_tarifa
  from imputacion i
  join proyecto p on p.id = i.proyecto_id
  join perfil pe on pe.id = i.empleado_id
  join subcategoria s on s.id = i.subcategoria_id
  where p.empresa_id = p_empresa
    and extract(year from i.fecha) = p_anio and extract(month from i.fecha) = p_mes
    and i.estado = 'aprobada'
    and resolver_tarifa(i.empleado_id, s.categoria_id, pe.empresa_id, i.fecha) is null;

  if v_sin_tarifa > 0 then
    select string_agg(format('%s (%s): %s h', sub.nombre, sub.categoria, sub.horas), '; ' order by sub.horas desc)
      into v_detalle
    from (
      select pe.nombre, c.nombre as categoria, sum(i.horas) as horas
      from imputacion i
      join proyecto p on p.id = i.proyecto_id
      join perfil pe on pe.id = i.empleado_id
      join subcategoria s on s.id = i.subcategoria_id
      join categoria c on c.id = s.categoria_id
      where p.empresa_id = p_empresa
        and extract(year from i.fecha) = p_anio and extract(month from i.fecha) = p_mes
        and i.estado = 'aprobada'
        and resolver_tarifa(i.empleado_id, s.categoria_id, pe.empresa_id, i.fecha) is null
      group by pe.nombre, c.nombre
    ) sub;

    v_partes := array_append(v_partes, format('%s h sin tarifa aplicable (%s)', v_sin_tarifa, v_detalle));
  end if;

  if v_pendientes > 0 then
    v_partes := array_append(v_partes, format('%s imputaciones pendientes de aprobar', v_pendientes));
  end if;

  if array_length(v_partes, 1) > 0 then
    raise exception 'No se puede cerrar: %', array_to_string(v_partes, ' y ');
  end if;

  update imputacion i
     set estado = 'cerrada', updated_at = now()
    from proyecto p
   where p.id = i.proyecto_id and p.empresa_id = p_empresa
     and extract(year from i.fecha) = p_anio and extract(month from i.fecha) = p_mes
     and i.estado = 'aprobada';

  insert into periodo (empresa_id, anio, mes, estado, cerrado_por, cerrado_en)
  values (p_empresa, p_anio, p_mes, 'cerrado', auth.uid(), now())
  on conflict (empresa_id, anio, mes)
  do update set estado = 'cerrado', cerrado_por = auth.uid(), cerrado_en = now();
end;
$$;

create or replace function importar_ausencias(p_filas jsonb) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  f    jsonb;
  v_id uuid;
  v_n  int := 0;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if not coalesce(es_admin_grupo(), false) then
    raise exception 'Solo admin_grupo puede importar ausencias';
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    insert into ausencia (perfil_id, tipo, fecha_inicio, fecha_fin, comentario, estado, resuelta_por, resuelta_at)
    values (
      (f ->> 'perfil_id')::uuid,
      (f ->> 'tipo')::tipo_ausencia,
      (f ->> 'fecha_inicio')::date,
      (f ->> 'fecha_fin')::date,
      'Importada (plan anual)',
      'aprobada', auth.uid(), now()
    )
    returning id into v_id;

    -- Igual que aprobar_ausencia(): los borradores de esos días dejan de tener sentido.
    delete from imputacion i
    using ausencia a
    where a.id = v_id
      and i.empleado_id = a.perfil_id
      and i.estado = 'borrador'
      and i.fecha between a.fecha_inicio and a.fecha_fin;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

create or replace function solicitar_ausencia(p_tipo tipo_ausencia, p_inicio date, p_fin date, p_comentario text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;

  insert into ausencia (perfil_id, tipo, fecha_inicio, fecha_fin, comentario)
  values (auth.uid(), p_tipo, p_inicio, p_fin, p_comentario)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function cancelar_ausencia(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;

  update ausencia
     set estado = 'cancelada', resuelta_at = now()
   where id = p_id and perfil_id = auth.uid() and estado = 'pendiente';
  if not found then
    raise exception 'Solo puedes cancelar tus propias solicitudes pendientes';
  end if;
end;
$$;

create or replace function aprobar_ausencia(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if not coalesce(puede_resolver_ausencia(p_id), false) then
    raise exception 'Sin permiso para resolver esta ausencia';
  end if;
  update ausencia
     set estado = 'aprobada', resuelta_por = auth.uid(), resuelta_at = now()
   where id = p_id and estado = 'pendiente';
  if not found then
    raise exception 'La ausencia no existe o no está pendiente';
  end if;
  -- Los borradores del empleado en esos días dejan de tener sentido.
  delete from imputacion i
  using ausencia a
  where a.id = p_id
    and i.empleado_id = a.perfil_id
    and i.estado = 'borrador'
    and i.fecha between a.fecha_inicio and a.fecha_fin;
end;
$$;

create or replace function rechazar_ausencia(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if not coalesce(puede_resolver_ausencia(p_id), false) then
    raise exception 'Sin permiso para resolver esta ausencia';
  end if;
  update ausencia
     set estado = 'rechazada', resuelta_por = auth.uid(), resuelta_at = now(), motivo_rechazo = p_motivo
   where id = p_id and estado = 'pendiente';
  if not found then
    raise exception 'La ausencia no existe o no está pendiente';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. A: funciones SOLO DE SERVIDOR -- guarda por el rol del JWT (service_role no tiene uid)
-- -----------------------------------------------------------------------------
-- ticket_ref_resincronizar() tiene EFECTOS (setval): pasa de `language sql` a plpgsql para poder lanzar.
create or replace function ticket_ref_resincronizar() returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_max int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Solo service_role puede resincronizar la secuencia de tickets' using errcode = '42501';
  end if;

  select coalesce(max(substr(ref, 3)::int), 0) into v_max from ticket;
  return setval('ticket_ref_seq', greatest(v_max, 1), v_max > 0);
end;
$$;

-- faltantes_recordatorio() es de lectura pero devuelve emails de toda la plantilla: si el REVOKE se perdiera, solo
-- devuelve filas cuando el JWT es de service_role (el cron). `language sql` se conserva: la guarda va en el WHERE.
create or replace function faltantes_recordatorio(p_desde date, p_hasta date)
returns table (perfil_id uuid, nombre text, email text, fecha date, requerido numeric, imputado numeric, falta numeric)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nombre, p.email, d::date as fecha,
         jornada_del_dia(p.empresa_id, d::date) as requerido,
         coalesce(sum(i.horas), 0) as imputado,
         jornada_del_dia(p.empresa_id, d::date) - coalesce(sum(i.horas), 0) as falta
  from perfil p
  cross join generate_series(p_desde, least(p_hasta, current_date), interval '1 day') d
  left join imputacion i
         on i.empleado_id = p.id and i.fecha = d::date and i.estado <> 'rechazada'
  where coalesce(auth.role(), '') = 'service_role'
    and p.activo
    and es_laborable(d::date, p.empresa_id)
    and not tiene_ausencia_aprobada(p.id, d::date)
  group by p.id, p.nombre, p.email, d
  having jornada_del_dia(p.empresa_id, d::date) - coalesce(sum(i.horas), 0) > 0
  order by d desc, p.nombre;
$$;

-- -----------------------------------------------------------------------------
-- 4. A: GRANTS -- primero cerrar todo, luego abrir explícitamente lo necesario
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

-- Funciones de trigger: nadie las invoca (Postgres solo comprueba EXECUTE al crear el trigger).
revoke execute on function
  handle_new_user(), imputacion_validar(), perfil_guardar_rol_empresa(), trg_ausencia_validar(),
  trg_empresa_jornada_defecto(), trg_imputacion_sin_ausencia(), trg_ticket_comentario_respuesta()
  from authenticated, service_role;

-- Solo servidor.
revoke execute on function faltantes_recordatorio(date, date), ticket_ref_resincronizar() from authenticated;
grant  execute on function faltantes_recordatorio(date, date), ticket_ref_resincronizar() to service_role;

-- RPC con efectos (E), de lectura (R) y helpers (H, I) que usan las policies, las vistas y las propias RPC:
grant execute on function
  -- E
  aprobar_ausencia(uuid), aprobar_imputaciones(uuid[]), cancelar_ausencia(uuid), cerrar_periodo(uuid, integer, integer),
  enviar_imputaciones(uuid[]), importar_ausencias(jsonb), imputar_directo(uuid, uuid, uuid, date, numeric, text),
  rechazar_ausencia(uuid, text), rechazar_imputaciones(uuid[], text), solicitar_ausencia(tipo_ausencia, date, date, text),
  -- R
  balance_mes(integer, integer), balance_mes_empleado(uuid, integer, integer), estado_dias_mes(integer, integer),
  faltantes(date, date), fte_mes(integer, integer), requeridas_efectivas(integer, integer), resumen_dia(date),
  resumen_mes(integer, integer), ticket_hilo(uuid),
  -- H
  auth_empresa(), auth_rol(), empleado_trabaja_en_empresa(uuid, uuid), empresa_de_perfil(uuid), empresa_de_proyecto(uuid),
  es_responsable_de(uuid), puede_resolver_ausencia(uuid), puede_ver_ticket(uuid),
  -- I
  admin_puede_ver_empresa(uuid), descripcion_obligatoria(), dias_ausencia_en_mes(date, date, uuid, integer, integer),
  es_admin_grupo(), es_festivo(date, uuid), es_laborable(date, uuid), horas_ausencia_en_mes(date, date, uuid, integer, integer),
  horas_requeridas(date, date, uuid), horas_requeridas_mes(integer, integer, uuid), jornada_del_dia(uuid, date),
  jornada_dias_mes(integer, integer, uuid), jornada_horas(), periodo_cerrado(uuid, date),
  resolver_tarifa(uuid, uuid, uuid, date), tiene_ausencia_aprobada(uuid, date)
  to authenticated, service_role;

-- Funciones futuras creadas por `postgres` (las migraciones): nacen SIN EXECUTE para anon/public. Hay que abrirlas con un
-- GRANT explícito (falla en cerrado). No cubre funciones creadas por otros roles (supabase_admin: panel/extensiones).
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- 5. AUTOCOMPROBACIÓN: si algo no queda como se ha descrito, la migración entera se revierte
-- -----------------------------------------------------------------------------
do $$
declare
  v_anon    text;
  v_falta   text;
  v_trigger text;
  v_srv     text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  if v_anon is not null then
    raise exception '023: anon conserva EXECUTE en: %', v_anon;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_falta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
    and p.proname not in ('faltantes_recordatorio', 'ticket_ref_resincronizar')
    and not has_function_privilege('authenticated', p.oid, 'execute');
  if v_falta is not null then
    raise exception '023: authenticated pierde EXECUTE en: %', v_falta;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_trigger
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute'));
  if v_trigger is not null then
    raise exception '023: funciones de trigger invocables en: %', v_trigger;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_srv
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('faltantes_recordatorio', 'ticket_ref_resincronizar')
    and (has_function_privilege('authenticated', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'));
  if v_srv is not null then
    raise exception '023: funciones solo-servidor mal concedidas: %', v_srv;
  end if;
end $$;
