-- =============================================================================
-- 021: (1) Guarda de rol/empresa en `perfil`  (2) ride-along: desempate de resumen_dia/resumen_mes
--
-- (1) HALLAZGO DE SEGURIDAD (Lote 4, verificación con sesión real de Marina, admin_empresa):
--     `perfil_update_admin` (001) deja a un admin_empresa actualizar CUALQUIER columna de los
--     perfiles de su empresa, incluido el suyo: por API directa podía ponerse (o poner a su gente)
--     rol = 'admin_grupo'. La UI ya decía "solo admin_grupo cambia rol/empresa" pero la BD no.
--     Reproducido antes de esta migración y rechazado después (tasks/todo.md, PLAN.md).
--
--     Regla: cambiar el `rol` o la `empresa_id` de un perfil es una operación estructural del
--     grupo -> solo admin_grupo (la "puerta única" de las fichas). Un admin_empresa sigue
--     editando departamento y categoría de su gente, nada más.
--
--     Por qué un TRIGGER y no una policy: en un UPDATE, USING ve la fila vieja y WITH CHECK la
--     nueva, nunca las dos a la vez; comparar OLD y NEW solo se puede en un trigger BEFORE UPDATE
--     (mismo patrón que imputacion_validar / descripcion_obligatoria, 012).
--       * `UPDATE OF rol, empresa_id`: solo se dispara si el UPDATE nombra esas columnas.
--       * `IS DISTINCT FROM`: un UPDATE que reenvía el MISMO valor (la ficha mandaba los cuatro
--         campos siempre) NO se bloquea; solo el cambio efectivo.
--       * Nota: para empresa_id, admin_empresa ya estaba frenado por el WITH CHECK de la policy
--         (la fila nueva debe seguir en SU empresa); la guarda lo hace explícito y no depende de
--         esa coincidencia.
--
--     service_role / scripts / importadores / migraciones: EXENTOS. Decisión: los triggers SÍ se
--     aplican a service_role (RLS no), y con service_role `auth.uid()` es null, así que
--     `es_admin_grupo()` daría null y la guarda bloquearía scripts legítimos (cambiar-emails,
--     seed-usuarios, rutas de import/alta de la app, que usan el cliente admin). En vez de
--     hacerles "pasar por admin_grupo", la guarda solo se aplica a los roles de BD de usuario
--     final de la API (`authenticated`, `anon`): service_role y postgres son infraestructura de
--     confianza (la service key no sale del servidor, verificado en F3.5). Los importadores
--     actuales tampoco tocan rol/empresa en un UPDATE (rol y empresa entran por INSERT vía
--     handle_new_user, 001), y `UPDATE OF` ni siquiera se dispara con sus UPDATE.
--     `current_user` (no un claim del JWT) porque el trigger es SECURITY INVOKER: es el rol que
--     PostgREST fija con SET LOCAL ROLE, y no se puede falsear desde la sesión del cliente.
--
--     INSERT: no hace falta guarda. `perfil.id` referencia `auth.users` y todo usuario de auth ya
--     tiene su perfil (handle_new_user, AFTER INSERT): un admin_empresa no puede crear cuentas de
--     auth ni insertar un perfil para una existente (PK duplicada).
-- =============================================================================

create or replace function perfil_guardar_rol_empresa() returns trigger
language plpgsql
as $$
begin
  if (new.rol is distinct from old.rol or new.empresa_id is distinct from old.empresa_id)
     and current_user in ('authenticated', 'anon')
     and not coalesce(es_admin_grupo(), false) then
    raise exception 'Solo un admin del grupo puede cambiar el rol o la empresa de un usuario'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger perfil_guardar_rol_empresa
  before update of rol, empresa_id on perfil
  for each row execute function perfil_guardar_rol_empresa();

-- =============================================================================
-- (2) RIDE-ALONG (independiente de la guarda): desempate de resumen_dia / resumen_mes.
--     Hallazgo del Lote 4: los `order by` de las listas `pendientes` / `ausentes` no desempataban
--     filas con el mismo valor de orden (mismo `imputado`, mismo pendiente), así que el orden
--     salía del orden físico de `perfil` y un simple UPDATE de prueba (que mueve la tupla)
--     cambiaba la huella SHA-256 CRUDA del RPC sin cambiar ningún dato. Ahora cada ORDER BY
--     termina en `nombre, id` (`id` = perfil.id, único) -> salida totalmente determinista.
--     Los datos no cambian: la huella CANÓNICA (arrays ordenados) `6c50f784` debe seguir igual;
--     la cruda pasa a ser estable (nuevo valor vigente, anotado en PLAN.md).
--     Cuerpos idénticos a los de 019 salvo los tres ORDER BY.
-- =============================================================================

-- resumen_dia() (010): requerido de cada persona = jornada de ESE día en SU empresa. ('jornada' global del JSON no se usa en la app: se deja.)
create or replace function resumen_dia(p_fecha date) returns json
language sql stable security definer set search_path = public
as $$
  with base as (
    select p.id, p.nombre, dep.nombre as departamento,
           case when es_laborable(p_fecha, p.empresa_id) then jornada_del_dia(p.empresa_id, p_fecha) else 0 end as requerido,
           coalesce((select sum(i.horas) from imputacion i
                      where i.empleado_id = p.id and i.fecha = p_fecha and i.estado <> 'rechazada'), 0) as imputado,
           tiene_ausencia_aprobada(p.id, p_fecha) as con_ausencia,
           (select a.tipo::text from ausencia a
              where a.perfil_id = p.id and a.estado = 'aprobada' and p_fecha between a.fecha_inicio and a.fecha_fin
              limit 1) as tipo_ausencia
    from perfil p
    left join departamento dep on dep.id = p.departamento_id
    where p.activo and admin_puede_ver_empresa(p.empresa_id)
  )
  select json_build_object(
    'fecha', p_fecha,
    'jornada', jornada_horas(),
    'total_empleados', count(*),
    'al_dia', count(*) filter (where requerido = 0 or con_ausencia or imputado >= requerido),
    'con_ausencia', count(*) filter (where con_ausencia),
    'sin_imputar', count(*) filter (where requerido > 0 and not con_ausencia and imputado = 0),
    'pendientes', coalesce((
      select json_agg(json_build_object('nombre', nombre, 'imputado', imputado, 'requerido', requerido, 'departamento', departamento) order by imputado asc, nombre, id)
      from base where requerido > 0 and not con_ausencia and imputado < requerido
    ), '[]'::json),
    'ausentes', coalesce((
      select json_agg(json_build_object('nombre', nombre, 'tipo', tipo_ausencia, 'departamento', departamento) order by nombre, id)
      from base where con_ausencia
    ), '[]'::json)
  )
  from base;
$$;

-- resumen_mes() (010): el requerido efectivo resta las HORAS de ausencia (suma de la jornada de cada día cubierto),
-- no días x jornada plana. `dias_cubiertos` se conserva solo para el flag con_ausencia.
create or replace function resumen_mes(p_anio int, p_mes int) returns json
language sql stable security definer set search_path = public
as $$
  with rango as (
    select make_date(p_anio, p_mes, 1) as d1,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as d2
  ),
  ausencia_mes as (
    select a.perfil_id,
           sum((select count(*) from generate_series(greatest(a.fecha_inicio, r.d1), least(a.fecha_fin, r.d2), interval '1 day') d
                where es_laborable(d::date, p.empresa_id))) as dias_cubiertos,
           sum(horas_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, p.empresa_id, p_anio, p_mes)) as horas_cubiertas
    from ausencia a
    join perfil p on p.id = a.perfil_id
    cross join rango r
    where a.estado = 'aprobada'
      and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
    group by a.perfil_id
  ),
  base as (
    select p.id, p.nombre, dep.nombre as departamento,
           horas_requeridas_mes(p_anio, p_mes, p.empresa_id)
             - coalesce(am.horas_cubiertas, 0) as requerido,
           coalesce(am.dias_cubiertos, 0) > 0 as con_ausencia,
           coalesce((select sum(i.horas) from imputacion i, rango r
                      where i.empleado_id = p.id and i.fecha between r.d1 and r.d2 and i.estado <> 'rechazada'), 0) as imputado
    from perfil p
    left join departamento dep on dep.id = p.departamento_id
    left join ausencia_mes am on am.perfil_id = p.id
    where p.activo and admin_puede_ver_empresa(p.empresa_id)
  )
  select json_build_object(
    'anio', p_anio, 'mes', p_mes,
    'total_empleados', count(*),
    'al_dia', count(*) filter (where imputado >= requerido),
    'con_ausencia', count(*) filter (where con_ausencia),
    'sin_imputar', count(*) filter (where requerido > 0 and imputado = 0),
    'horas_requeridas_total', coalesce(sum(requerido), 0),
    'horas_imputadas_total', coalesce(sum(imputado), 0),
    'pendientes', coalesce((
      select json_agg(json_build_object('nombre', nombre, 'imputado', imputado, 'requerido', requerido, 'departamento', departamento) order by (requerido - imputado) desc, nombre, id)
      from base where imputado < requerido
    ), '[]'::json)
  )
  from base;
$$;
