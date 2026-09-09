-- =============================================================================
-- 011_estado_dias_mes_y_cierre.sql
-- F4 (Cierre y exports), Paso 1:
--   1. estado_dias_mes(): agregado por-día-del-mes que faltaba para pintar el
--      calendario "Seguimiento del día" de InicioEscritorio.tsx (admin) con
--      datos reales -- resumen_dia()/resumen_mes() (010) son de un solo día o
--      totales de mes, ninguna sirve para el punto de cada celda.
--   2. cerrar_periodo(): sus dos precondiciones (pendientes, sin-tarifa) eran
--      excepciones secuenciales -- si había pendientes, ni se calculaba
--      sin-tarifa, así que el mensaje nunca combinaba ambas causas como pide
--      el mock ("No se puede cerrar: hay 12,0 h sin tarifa y 3 empleados con
--      días incompletos"). Se combinan en una sola excepción cuando coexisten.
-- =============================================================================

-- Mismo estándar que resumen_dia()/resumen_mes() (010): security definer,
-- SIN parámetro de empresa -- se autoacota vía admin_puede_ver_empresa() en
-- el WHERE sobre perfil (admin_grupo agrega todo el grupo por día,
-- admin_empresa solo la suya).
--
-- El "requerido" del día descuenta, por cada empleado activo visible:
--   - es_laborable(día, SU empresa) -- ya evita que un festivo de una sola
--     empresa haga parecer incompleto el día del resto del grupo, porque cada
--     fila del cross join usa la empresa de SU empleado, no una global.
--   - tiene_ausencia_aprobada(empleado, día) -- sin esto, un día con alguien
--     de baja/vacaciones aprobada exigiría su jornada igualmente y jamás
--     podría salir "completo" aunque el resto cumpliera (caso real del seed:
--     1-2 sept, baja aprobada de Andrés).
-- requerido = 0 cubre a la vez "festivo para todos" y "todo el ámbito visible
-- está de baja/vacaciones ese día" -- en ambos casos se pinta como
-- no-laborable (sin punto), nunca "completo" por casualidad aritmética.
create or replace function estado_dias_mes(p_anio int, p_mes int)
returns table (fecha date, estado text)
language sql stable security definer set search_path = public
as $$
  with rango as (
    select generate_series(
      make_date(p_anio, p_mes, 1),
      (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date,
      interval '1 day'
    )::date as d
  ),
  empleados as (
    select p.id, p.empresa_id from perfil p where p.activo and admin_puede_ver_empresa(p.empresa_id)
  ),
  requerido_dia as (
    select r.d, sum(
      case when es_laborable(r.d, e.empresa_id) and not tiene_ausencia_aprobada(e.id, r.d)
           then jornada_horas() else 0 end
    ) as requerido
    from rango r cross join empleados e
    group by r.d
  ),
  imputado_dia as (
    select i.fecha, sum(i.horas) as h
    from imputacion i
    join empleados e on e.id = i.empleado_id
    where i.estado <> 'rechazada'
      and i.fecha between (select min(d) from rango) and (select max(d) from rango)
    group by i.fecha
  )
  select rd.d,
    case
      when rd.requerido = 0 then 'no-laborable'
      when rd.d > current_date then 'futuro'
      when coalesce(idia.h, 0) >= rd.requerido then 'completo'
      else 'incompleto'
    end
  from requerido_dia rd
  left join imputado_dia idia on idia.fecha = rd.d
  order by rd.d;
$$;

grant execute on function estado_dias_mes(int, int) to authenticated;

-- cerrar_periodo(): combina ambas precondiciones en un único mensaje cuando
-- coexisten. El resto de la función (marcar imputacion como cerrada, upsert
-- en periodo) es idéntico a 009.
create or replace function cerrar_periodo(p_empresa uuid, p_anio int, p_mes int) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pendientes int;
  v_sin_tarifa numeric;
  v_detalle    text;
  v_partes     text[] := '{}';
begin
  if not (es_admin_grupo() or (auth_rol() = 'admin_empresa' and auth_empresa() = p_empresa)) then
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

grant execute on function cerrar_periodo(uuid, int, int) to authenticated;
