-- =============================================================================
-- 006_seguridad_vistas_fte_cierre_imputacion_directa.sql
-- Cuatro correcciones de la misma familia (permisos e integridad de agregados),
-- encontradas al diseñar el alcance de admin_empresa para F3. Aplicar y pushear
-- de inmediato: la primera es una fuga de datos activa, no un hueco teórico.
-- =============================================================================
--
-- 1. FUGA DE DATOS CONFIRMADA: v_imputacion_valorada, v_ausencia_dias y
--    v_refacturacion_mensual se crearon sin security_invoker=true. En
--    Postgres 15+ eso significa que la vista corre con los permisos del
--    PROPIETARIO, saltando la RLS de las tablas base por completo. Probado
--    contra la base real: un empleado normal (Andrés Fuentes, sin rol admin)
--    veía imputaciones de 7 personas distintas, ausencias de 4 personas y
--    15 filas de refacturación de todo el grupo. Fix: security_invoker=true
--    en las tres -- con eso heredan la RLS de imputacion/ausencia, que ya
--    está bien diseñada (imputacion_select cubre correctamente el caso
--    intragrupo).
-- =============================================================================

alter view v_imputacion_valorada   set (security_invoker = true);
alter view v_ausencia_dias         set (security_invoker = true);
alter view v_refacturacion_mensual set (security_invoker = true);

-- -----------------------------------------------------------------------------
-- 2. Helper de acotación por empresa para admin_empresa. Se extrae porque el
--    mismo predicado se repite 3+ veces (faltantes() ya existente, fte_mes()
--    aquí abajo, resumen_dia()/resumen_mes() en la siguiente migración).
-- -----------------------------------------------------------------------------
create or replace function admin_puede_ver_empresa(p_empresa uuid) returns boolean
language sql stable
as $$ select es_admin_grupo() or (auth_rol() = 'admin_empresa' and auth_empresa() = p_empresa) $$;

-- -----------------------------------------------------------------------------
-- 3. fte_mes(): no acotaba por empresa (un admin_empresa veía el FTE de TODO
--    el grupo). Mismo predicado que faltantes(), ahora vía el helper.
-- -----------------------------------------------------------------------------
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
    and admin_puede_ver_empresa(p.empresa_id)
  order by p.nombre, pr.nombre;
$$;

grant execute on function fte_mes(int, int) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. cerrar_periodo(): no comprobaba horas sin tarifa (PLAN.md regla 5 y el
--    propio mock lo exigen). Se valora con resolver_tarifa() A FECHA DE CADA
--    IMPUTACIÓN (las vigencias importan), sobre las 'aprobada' del periodo, y
--    se aborta con el desglose (persona/categoría) si hay alguna sin tarifa.
-- -----------------------------------------------------------------------------
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
    select string_agg(format('%s (%s): %s h', pe.nombre, c.nombre, sum(i.horas)), '; ' order by sum(i.horas) desc)
      into v_detalle
    from imputacion i
    join proyecto p on p.id = i.proyecto_id
    join perfil pe on pe.id = i.empleado_id
    join subcategoria s on s.id = i.subcategoria_id
    join categoria c on c.id = s.categoria_id
    where p.empresa_id = p_empresa
      and extract(year from i.fecha) = p_anio and extract(month from i.fecha) = p_mes
      and i.estado = 'aprobada'
      and resolver_tarifa(i.empleado_id, s.categoria_id, pe.empresa_id, i.fecha) is null
    group by pe.nombre, c.nombre;

    raise exception 'No se puede cerrar: % h sin tarifa aplicable (%)', v_sin_tarifa, v_detalle;
  end if;

  -- Las aprobadas pasan a cerradas (inmutables).
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

-- -----------------------------------------------------------------------------
-- 5. Imputación directa: imputacion_insert exige empleado_id = auth.uid(), un
--    admin no puede insertar en nombre de otro con un INSERT normal. Nueva RPC
--    security definer. Entra como 'aprobada' (acto de autoridad del admin, no
--    un borrador que el empleado deba enviar). creada_por deja auditoría de
--    quién la metió de verdad (null = el propio empleado). Autorizada solo
--    para admin_grupo o admin_empresa DE LA EMPRESA DEL EMPLEADO (no
--    responsables de proyecto: ese poder es de F5, no se mezcla aquí).
--
--    No se repite aquí la comprobación de "empleado asignado al proyecto":
--    ya vive en el trigger imputacion_validar_trg (001, líneas 195-201),
--    que dispara en CUALQUIER insert sobre imputacion sea cual sea el
--    camino -- confirmado leyendo el trigger, no solo la policy RLS. Mismo
--    razonamiento para tope de horas, ausencia bloqueante y periodo cerrado:
--    son triggers, no políticas, así que security definer no los salta.
--    Verificado con test negativo real (ver reporte), no solo por lectura.
-- -----------------------------------------------------------------------------
alter table imputacion add column if not exists creada_por uuid references perfil(id);

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
  select empresa_id into v_empresa from perfil where id = p_empleado;
  if v_empresa is null then
    raise exception 'El empleado indicado no existe';
  end if;

  if not admin_puede_ver_empresa(v_empresa) then
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

grant execute on function imputar_directo(uuid, uuid, uuid, date, numeric, text) to authenticated;
