-- =============================================================================
-- 004_balance_mes_y_requeridas_efectivas.sql
-- Soporte de datos para el contrato "requeridas efectivas" (PLAN.md sección 4):
--   requeridas_efectivas(empleado, mes) =
--     horas_requeridas_mes(empresa) - (dias_vacaciones+dias_baja+dias_permiso) x jornada
-- La aritmética vive en un único helper TS (src/lib/horas/requeridas-efectivas.ts);
-- esta migración solo asegura que existen todos los ingredientes:
--   1. fte_mes(): le faltaba dias_permiso (tipo_ausencia 'otro_permiso' no se sumaba).
--   2. Nueva balance_mes(): fte_mes() es admin-only y una fila por (empleado,
--      proyecto) via INNER JOIN con imputacion -- no sirve para el saldo propio
--      del empleado (necesita una fila aunque no haya imputado nada aún, y debe
--      poder consultarla el propio empleado, no solo admins).
-- =============================================================================

-- 1. fte_mes(): añade dias_permiso. Cambia la forma de RETURNS TABLE -> drop antes.
drop function if exists fte_mes(int, int);

create or replace function fte_mes(p_anio int, p_mes int)
returns table (
  empleado text, email text, empresa_empleado text,
  proyecto text, empresa_proyecto text,
  horas_proyecto numeric, horas_imputadas_total numeric, horas_requeridas numeric,
  dias_vacaciones int, dias_baja int, dias_permiso int
)
language sql stable security definer set search_path = public
as $$
  with rango as (
    select make_date(p_anio, p_mes, 1) as d1,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as d2
  ),
  horas as (
    select i.empleado_id, i.proyecto_id, sum(i.horas) as h
    from imputacion i, rango r
    where i.fecha between r.d1 and r.d2 and i.estado <> 'rechazada'
    group by i.empleado_id, i.proyecto_id
  ),
  aus as (
    select a.perfil_id,
           sum(case when a.tipo = 'vacaciones'   then v.dias_laborables else 0 end)::int as vac,
           sum(case when a.tipo = 'baja_medica'  then v.dias_laborables else 0 end)::int as baja,
           sum(case when a.tipo = 'otro_permiso' then v.dias_laborables else 0 end)::int as permiso
    from v_ausencia_dias v
    join ausencia a on a.id = v.id, rango r
    where a.estado = 'aprobada'
      and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
    group by a.perfil_id
  )
  select p.nombre, p.email, ep.nombre,
         pr.nombre, ed.nombre,
         h.h,
         sum(h.h) over (partition by p.id),
         horas_requeridas_mes(p_anio, p_mes, p.empresa_id),
         coalesce(a.vac, 0), coalesce(a.baja, 0), coalesce(a.permiso, 0)
  from horas h
  join perfil p   on p.id = h.empleado_id
  join empresa ep on ep.id = p.empresa_id
  join proyecto pr on pr.id = h.proyecto_id
  join empresa ed on ed.id = pr.empresa_id
  left join aus a on a.perfil_id = p.id
  where auth_rol() in ('admin_grupo', 'admin_empresa')
  order by p.nombre, pr.nombre;
$$;

grant execute on function fte_mes(int, int) to authenticated;

-- 2. balance_mes(): una fila para EL PROPIO empleado (auth.uid()), con LEFT JOIN
--    a imputacion/ausencia -- existe aunque el mes esté vacío. Ingredientes crudos
--    para requeridas_efectivas(); la resta vive en TS, no aquí.
create or replace function balance_mes(p_anio int, p_mes int)
returns table (
  horas_requeridas numeric,
  horas_imputadas numeric,
  dias_vacaciones int,
  dias_baja int,
  dias_permiso int
)
language sql stable security definer set search_path = public
as $$
  with rango as (
    select make_date(p_anio, p_mes, 1) as d1,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as d2
  ),
  yo as (
    select id, empresa_id from perfil where id = auth.uid()
  ),
  horas as (
    select coalesce(sum(i.horas), 0) as h
    from yo
    cross join rango r
    left join imputacion i
      on i.empleado_id = yo.id and i.fecha between r.d1 and r.d2 and i.estado <> 'rechazada'
  ),
  aus as (
    select
      coalesce(sum(case when a.tipo = 'vacaciones' and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then v.dias_laborables else 0 end), 0)::int as vac,
      coalesce(sum(case when a.tipo = 'baja_medica' and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then v.dias_laborables else 0 end), 0)::int as baja,
      coalesce(sum(case when a.tipo = 'otro_permiso' and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then v.dias_laborables else 0 end), 0)::int as permiso
    from yo
    cross join rango r
    left join ausencia a on a.perfil_id = yo.id and a.estado = 'aprobada'
    left join v_ausencia_dias v on v.id = a.id
  )
  select horas_requeridas_mes(p_anio, p_mes, yo.empresa_id),
         horas.h,
         aus.vac, aus.baja, aus.permiso
  from yo, horas, aus;
$$;

grant execute on function balance_mes(int, int) to authenticated;
