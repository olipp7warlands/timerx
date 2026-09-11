-- =============================================================================
-- 014: balance_mes_empleado() -- balance/requeridas-efectivas de un empleado
-- arbitrario para la ficha de usuario (admin). No existía ningún RPC así,
-- solo balance_mes() acotado a auth.uid().
--
-- Bug encontrado al escribir esto, corregido en la misma migración:
-- balance_mes() (004) y fte_mes() (última versión viva, 006) no recortaban
-- una ausencia aprobada a los días DENTRO del mes consultado -- solo
-- comprobaban solape (daterange && daterange) y sumaban
-- v_ausencia_dias.dias_laborables, que es el total de días laborables de
-- TODA la ausencia (fecha_inicio->fecha_fin, sin acotar a ningún mes). Una
-- ausencia que cruce frontera de mes atribuía también los días del otro mes
-- al mes consultado.
--
-- faltantes()/faltantes_recordatorio() (002/012) NO tienen este bug y no se
-- tocan: operan día a día vía generate_series + tiene_ausencia_aprobada()
-- (booleano puntual por fecha, sin agregación de rango) -- no hay nada que
-- recortar, cada día generado ya cae dentro de la ventana que pidió el
-- caller.
-- =============================================================================

-- 1. Helper compartido (mismo criterio que admin_puede_ver_empresa, 006):
--    una implementación, todos los consumidores la llaman.
create or replace function dias_ausencia_en_mes(p_fecha_inicio date, p_fecha_fin date, p_empresa uuid, p_anio int, p_mes int)
returns int
language sql stable
as $$
  select count(*)::int
  from generate_series(
    greatest(p_fecha_inicio, make_date(p_anio, p_mes, 1)),
    least(p_fecha_fin, (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date),
    interval '1 day'
  ) d
  where es_laborable(d::date, p_empresa);
$$;

-- 2. balance_mes(): aus CTE corregida (ya no depende de v_ausencia_dias).
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
      coalesce(sum(case when a.tipo = 'vacaciones'   and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, yo.empresa_id, p_anio, p_mes) else 0 end), 0)::int as vac,
      coalesce(sum(case when a.tipo = 'baja_medica'  and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, yo.empresa_id, p_anio, p_mes) else 0 end), 0)::int as baja,
      coalesce(sum(case when a.tipo = 'otro_permiso' and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, yo.empresa_id, p_anio, p_mes) else 0 end), 0)::int as permiso
    from yo
    cross join rango r
    left join ausencia a on a.perfil_id = yo.id and a.estado = 'aprobada'
  )
  select horas_requeridas_mes(p_anio, p_mes, yo.empresa_id),
         horas.h,
         aus.vac, aus.baja, aus.permiso
  from yo, horas, aus;
$$;

grant execute on function balance_mes(int, int) to authenticated;

-- 3. fte_mes(): aus CTE corregida (gana join a perfil para tener
--    empresa_id disponible; ya no depende de v_ausencia_dias). Todo lo
--    demás (rango, horas con estado in ('aprobada','cerrada'), select
--    final, gate de rol) se mantiene byte-idéntico a la versión de 006.
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
    where i.fecha between r.d1 and r.d2 and i.estado in ('aprobada', 'cerrada')
    group by i.empleado_id, i.proyecto_id
  ),
  aus as (
    select a.perfil_id,
           sum(case when a.tipo = 'vacaciones'   then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, pa.empresa_id, p_anio, p_mes) else 0 end)::int as vac,
           sum(case when a.tipo = 'baja_medica'  then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, pa.empresa_id, p_anio, p_mes) else 0 end)::int as baja,
           sum(case when a.tipo = 'otro_permiso' then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, pa.empresa_id, p_anio, p_mes) else 0 end)::int as permiso
    from ausencia a
    join perfil pa on pa.id = a.perfil_id, rango r
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
    and admin_puede_ver_empresa(p.empresa_id)
  order by p.nombre, pr.nombre;
$$;

grant execute on function fte_mes(int, int) to authenticated;

-- 4. balance_mes_empleado(): mismas CTEs que balance_mes(), "emp" en vez de
--    "yo", gateada con admin_puede_ver_empresa (mismo criterio "sin
--    intragrupo" que resumen_dia/resumen_mes/estado_dias_mes/fte_mes).
create or replace function balance_mes_empleado(p_empleado_id uuid, p_anio int, p_mes int)
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
  emp as (
    select id, empresa_id from perfil where id = p_empleado_id and admin_puede_ver_empresa(empresa_id)
  ),
  horas as (
    select coalesce(sum(i.horas), 0) as h
    from emp
    cross join rango r
    left join imputacion i
      on i.empleado_id = emp.id and i.fecha between r.d1 and r.d2 and i.estado <> 'rechazada'
  ),
  aus as (
    select
      coalesce(sum(case when a.tipo = 'vacaciones'   and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, emp.empresa_id, p_anio, p_mes) else 0 end), 0)::int as vac,
      coalesce(sum(case when a.tipo = 'baja_medica'  and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, emp.empresa_id, p_anio, p_mes) else 0 end), 0)::int as baja,
      coalesce(sum(case when a.tipo = 'otro_permiso' and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(r.d1, r.d2, '[]')
                    then dias_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, emp.empresa_id, p_anio, p_mes) else 0 end), 0)::int as permiso
    from emp
    cross join rango r
    left join ausencia a on a.perfil_id = emp.id and a.estado = 'aprobada'
  )
  select horas_requeridas_mes(p_anio, p_mes, emp.empresa_id),
         horas.h,
         aus.vac, aus.baja, aus.permiso
  from emp, horas, aus;
$$;

grant execute on function balance_mes_empleado(uuid, int, int) to authenticated;
