-- =============================================================================
-- 009_fix_cerrar_periodo_nested_aggregate.sql
-- Bug real en 006: el desglose de "horas sin tarifa" anidaba sum(i.horas)
-- dentro del ORDER BY de string_agg(), y ambos son funciones de agregado --
-- Postgres lo rechaza en ejecución (42803, "aggregate function calls cannot
-- be nested"), confirmado al ejercitar cerrar_periodo() de verdad contra
-- datos reales (42h sin tarifa en Wowinx SL, septiembre 2026). No se detectó
-- al aplicar la 006 porque CREATE FUNCTION no valida el cuerpo plpgsql en
-- profundidad, solo al ejecutarlo. Fix: agregar primero en una subconsulta,
-- luego formatear+concatenar sobre el resultado ya agregado.
-- =============================================================================

create or replace function cerrar_periodo(p_empresa uuid, p_anio int, p_mes int) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pendientes int;
  v_sin_tarifa numeric;
  v_detalle text;
begin
  if not (es_admin_grupo() or (auth_rol() = 'admin_empresa' and auth_empresa() = p_empresa)) then
    raise exception 'Sin permisos para cerrar el periodo';
  end if;

  select count(*) into v_pendientes
  from imputacion i join proyecto p on p.id = i.proyecto_id
  where p.empresa_id = p_empresa
    and extract(year from i.fecha) = p_anio and extract(month from i.fecha) = p_mes
    and i.estado in ('borrador', 'enviada');

  if v_pendientes > 0 then
    raise exception 'No se puede cerrar: % imputaciones pendientes de aprobar', v_pendientes;
  end if;

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

    raise exception 'No se puede cerrar: % h sin tarifa aplicable (%)', v_sin_tarifa, v_detalle;
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
