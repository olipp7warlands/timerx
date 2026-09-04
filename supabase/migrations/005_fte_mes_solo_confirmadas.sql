-- =============================================================================
-- 005_fte_mes_solo_confirmadas.sql
-- Criterio de estados de imputacion.horas, documentado para no reabrir esto:
--   - balance_mes() (saldo propio del empleado): estado <> 'rechazada'
--     -- cuenta borrador+enviada+aprobada+cerrada, todo lo suyo salvo lo
--     -- explícitamente rechazado. Verificado correcto, no se toca aquí.
--   - fte_mes() (reporting/FTE de admin, base del Excel oficial): SOLO
--     estado in ('aprobada','cerrada') -- un borrador o una imputación enviada
--     todavía no está confirmada por un admin; no debe figurar en el informe
--     oficial de horas del grupo. Este archivo corrige fte_mes(), que hasta
--     ahora usaba el mismo criterio laxo que balance_mes() (<> 'rechazada'),
--     inflando el informe con horas aún no aprobadas.
-- =============================================================================

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
    where i.fecha between r.d1 and r.d2 and i.estado in ('aprobada', 'cerrada')
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
