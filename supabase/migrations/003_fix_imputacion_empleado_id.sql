-- =============================================================================
-- 003_fix_imputacion_empleado_id.sql
-- Correctiva: la 002 referenciaba imputacion.perfil_id, pero la columna real
-- (001_esquema_inicial.sql) es imputacion.empleado_id. Afecta a CUATRO piezas:
--   1. trg_imputacion_sin_ausencia()  2. aprobar_ausencia()
--   3. faltantes()                    4. fte_mes()
-- Las referencias a ausencia.perfil_id y perfil.id son correctas y no se tocan.
-- Solo create or replace: no altera tablas ni el trigger ya creado.
-- =============================================================================

create or replace function trg_imputacion_sin_ausencia() returns trigger
language plpgsql
as $$
begin
  if tiene_ausencia_aprobada(new.empleado_id, new.fecha) then
    raise exception 'El día % tiene una ausencia aprobada: no admite imputaciones', new.fecha;
  end if;
  return new;
end;
$$;

create or replace function aprobar_ausencia(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not puede_resolver_ausencia(p_id) then
    raise exception 'Sin permiso para resolver esta ausencia';
  end if;
  update ausencia
     set estado = 'aprobada', resuelta_por = auth.uid(), resuelta_at = now()
   where id = p_id and estado = 'pendiente';
  if not found then
    raise exception 'La ausencia no existe o no está pendiente';
  end if;
  delete from imputacion i
  using ausencia a
  where a.id = p_id
    and i.empleado_id = a.perfil_id
    and i.estado = 'borrador'
    and i.fecha between a.fecha_inicio and a.fecha_fin;
end;
$$;

create or replace function faltantes(p_desde date, p_hasta date)
returns table (perfil_id uuid, nombre text, email text, fecha date, requerido numeric, imputado numeric, falta numeric)
language sql stable security definer set search_path = public
as $$
  select p.id, p.nombre, p.email, d::date as fecha,
         jornada_horas() as requerido,
         coalesce(sum(i.horas), 0) as imputado,
         jornada_horas() - coalesce(sum(i.horas), 0) as falta
  from perfil p
  cross join generate_series(p_desde, least(p_hasta, current_date), interval '1 day') d
  left join imputacion i
         on i.empleado_id = p.id and i.fecha = d::date and i.estado <> 'rechazada'
  where p.activo
    and es_laborable(d::date, p.empresa_id)
    and not tiene_ausencia_aprobada(p.id, d::date)
    and (es_admin_grupo() or auth_rol() = 'admin_empresa' or es_responsable_de(p.id))
    and (auth_rol() <> 'admin_empresa' or p.empresa_id = auth_empresa() or es_admin_grupo())
  group by p.id, p.nombre, p.email, d
  having jornada_horas() - coalesce(sum(i.horas), 0) > 0
  order by d desc, p.nombre;
$$;

create or replace function fte_mes(p_anio int, p_mes int)
returns table (
  empleado text, email text, empresa_empleado text,
  proyecto text, empresa_proyecto text,
  horas_proyecto numeric, horas_imputadas_total numeric, horas_requeridas numeric,
  dias_vacaciones int, dias_baja int
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
           sum(case when a.tipo = 'vacaciones' then v.dias_laborables else 0 end)::int as vac,
           sum(case when a.tipo = 'baja_medica' then v.dias_laborables else 0 end)::int as baja
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
         coalesce(a.vac, 0), coalesce(a.baja, 0)
  from horas h
  join perfil p   on p.id = h.empleado_id
  join empresa ep on ep.id = p.empresa_id
  join proyecto pr on pr.id = h.proyecto_id
  join empresa ed on ed.id = pr.empresa_id
  left join aus a on a.perfil_id = p.id
  where auth_rol() in ('admin_grupo', 'admin_empresa')
  order by p.nombre, pr.nombre;
$$;
