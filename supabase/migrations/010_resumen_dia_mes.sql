-- =============================================================================
-- 010_resumen_dia_mes.sql
-- KPIs de Inicio del panel de administración (F3, Paso 1). Mismo estándar que
-- faltantes(): security definer set search_path=public, acotado por empresa
-- vía admin_puede_ver_empresa() (la propia función ya excluye a quien no sea
-- admin_grupo/admin_empresa, sin necesidad de un raise aparte). Criterio de
-- horas EMPLEADO (estado <> 'rechazada') -- seguimiento operativo, no valoración.
-- =============================================================================

-- Día: KPIs 2x2 (al día / con ausencia / sin imputar / total) + listas de
-- pendientes y ausentes del día, en el ámbito de quien llama.
create or replace function resumen_dia(p_fecha date) returns json
language sql stable security definer set search_path = public
as $$
  with base as (
    select p.id, p.nombre, dep.nombre as departamento,
           case when es_laborable(p_fecha, p.empresa_id) then jornada_horas() else 0 end as requerido,
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
      select json_agg(json_build_object('nombre', nombre, 'imputado', imputado, 'requerido', requerido, 'departamento', departamento) order by imputado asc)
      from base where requerido > 0 and not con_ausencia and imputado < requerido
    ), '[]'::json),
    'ausentes', coalesce((
      select json_agg(json_build_object('nombre', nombre, 'tipo', tipo_ausencia, 'departamento', departamento) order by nombre)
      from base where con_ausencia
    ), '[]'::json)
  )
  from base;
$$;

grant execute on function resumen_dia(date) to authenticated;

-- Mes: mismos KPIs a nivel mes. requerido_efectivo neto de ausencias aprobadas
-- que caen dentro del mes (mismo contrato "requeridas efectivas" documentado
-- en PLAN.md para el empleado: los días laborables cubiertos por una ausencia
-- aprobada no cuentan como exigibles).
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
                where es_laborable(d::date, p.empresa_id))) as dias_cubiertos
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
             - coalesce(am.dias_cubiertos, 0) * jornada_horas() as requerido,
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
      select json_agg(json_build_object('nombre', nombre, 'imputado', imputado, 'requerido', requerido, 'departamento', departamento) order by (requerido - imputado) desc)
      from base where imputado < requerido
    ), '[]'::json)
  )
  from base;
$$;

grant execute on function resumen_mes(int, int) to authenticated;
