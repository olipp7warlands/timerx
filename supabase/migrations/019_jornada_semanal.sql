-- =============================================================================
-- 019: JORNADA SEMANAL por empresa (empresa_jornada) -- núcleo delicado: toca la
-- familia de requeridas de la 014. Incluye además dos ajustes de la 018 hallados
-- en su verificación (sección 0), para que 018+019 formen un conjunto correcto.
--
-- Hasta hoy la jornada era UNA cifra plana (`ajuste.jornada_horas`) y el fin de
-- semana estaba cableado (isodow <= 5). Ahora cada empresa define las horas de
-- cada día de la semana (ISO 1-7): un día con 0 h no es laborable, y las
-- requeridas del mes son la SUMA de la jornada de cada día laborable.
--
-- SEED = COMPORTAMIENTO ACTUAL, no un "7" fijo: L-V toman el valor VIVO de
-- `ajuste.jornada_horas` (en la demo es 8: alguien lo cambió desde el panel) y
-- S-D 0. Así, con el seed plano, ninguna cifra se mueve ni un decimal
-- (regresión byte-idéntica verificada). `ajuste.jornada_horas` queda como valor
-- por defecto de una empresa sin filas propias.
--
-- Idempotente (create if not exists / or replace / on conflict / drop policy if exists):
-- si la verificación pidiera un ajuste, se puede reaplicar sin efectos dobles.
--
-- INVENTARIO de la familia (qué toca jornada o laborables) -- se parchea SOLO lo demostrado:
--   PARCHEADAS (usaban jornada plana `jornada_horas()` por día, incorrecto con jornada variable):
--     faltantes()              002:276  requerido/falta = jornada_horas()        -> jornada_del_dia
--     faltantes_recordatorio() 012      idem (gemela sin gate de rol)            -> jornada_del_dia
--     resumen_dia()            010      requerido = jornada_horas() si laborable -> jornada_del_dia
--     resumen_mes()            010      requerido = requeridas_mes - dias*jornada_horas()
--                                        -> requeridas_mes - horas de ausencia (suma de la jornada de cada día cubierto)
--     estado_dias_mes()        011      requerido del día = jornada_horas()      -> jornada_del_dia
--   GENERALIZADAS en su definición (los consumidores no cambian una línea):
--     es_laborable()           002      "isodow<=5 y no festivo" -> "jornada del día > 0 y no festivo"
--     horas_requeridas()       002      laborables x jornada_plana -> SUMA de la jornada de cada día laborable
--                                        (horas_requeridas_mes() la llama: cubre balance_mes, balance_mes_empleado,
--                                         fte_mes, resumen_mes, la ficha y el export FTE)
--   NO TOCADAS, con cita:
--     balance_mes / balance_mes_empleado / fte_mes (014)  solo usan horas_requeridas_mes() y dias_ausencia_en_mes()
--                                        (cuenta DÍAS laborables, correcto con cualquier jornada); su forma de salida no cambia.
--     dias_ausencia_en_mes (014), v_ausencia_dias (002)  cuentan días vía es_laborable() -> ya generalizados.
--     cerrar_periodo (011)  no usa jornada ni laborables (solo pendientes y horas sin tarifa).
--   NUEVO: horas_ausencia_en_mes() y requeridas_efectivas() -- la deducción de ausencias en horas
--     ("requeridas efectivas") pasa a ser SUMA de la jornada de cada día cubierto, no días x jornada plana.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Ajustes de la 018 (hallados al verificarla con sesiones reales)
-- -----------------------------------------------------------------------------
-- 0.a  ticket_select consultaba la tabla `ticket` desde puede_ver_ticket(id): el RETURNING de un INSERT no veía
--      su propia fila y el alta legítima de un empleado fallaba con "violates row-level security". La policy
--      pasa a evaluar la fila directamente (helper security definer sobre perfil, sin releer ticket).
create or replace function empresa_de_perfil(p_perfil uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select empresa_id from perfil where id = p_perfil $$;

drop policy if exists ticket_select on ticket;
create policy ticket_select on ticket for select to authenticated
  using (
    creado_por = auth.uid()
    or es_admin_grupo()
    or (auth_rol() = 'admin_empresa' and empresa_de_perfil(creado_por) = auth_empresa())
  );

-- 0.b  Los tickets no se borran, pero las pruebas de QA sí se limpian (service_role) y una secuencia no es
--      transaccional: tras limpiar, la siguiente ref saltaría. Resincroniza la secuencia con el máximo real.
--      Solo service_role.
create or replace function ticket_ref_resincronizar() returns bigint
language sql security definer set search_path = public
as $$
  select setval('ticket_ref_seq', greatest(coalesce((select max(substr(ref, 3)::int) from ticket), 0), 1),
                coalesce((select max(substr(ref, 3)::int) from ticket), 0) > 0)
$$;

revoke all on function ticket_ref_resincronizar() from public, anon, authenticated;
grant execute on function ticket_ref_resincronizar() to service_role;

-- -----------------------------------------------------------------------------
-- 1. Tabla empresa_jornada
-- -----------------------------------------------------------------------------
create table if not exists empresa_jornada (
  empresa_id  uuid not null references empresa(id) on delete cascade,
  dia_semana  int  not null check (dia_semana between 1 and 7),   -- ISO: 1 lunes ... 7 domingo
  horas       numeric not null check (horas >= 0 and horas <= 24),
  unique (empresa_id, dia_semana)
);

alter table empresa_jornada enable row level security;

-- Mismo patrón que `ajuste`: lectura abierta (los calendarios del empleado la necesitan), escritura solo admin_grupo.
drop policy if exists empresa_jornada_select on empresa_jornada;
drop policy if exists empresa_jornada_admin  on empresa_jornada;
create policy empresa_jornada_select on empresa_jornada for select to authenticated using (true);
create policy empresa_jornada_admin  on empresa_jornada for all    to authenticated
  using (es_admin_grupo()) with check (es_admin_grupo());

-- SEED: valor VIVO de ajuste.jornada_horas en L-V, 0 en S-D (ver cabecera).
insert into empresa_jornada (empresa_id, dia_semana, horas)
select e.id, d.n, case when d.n <= 5 then jornada_horas() else 0 end
from empresa e cross join generate_series(1, 7) as d(n)
on conflict (empresa_id, dia_semana) do nothing;

-- Toda empresa nueva nace con sus 7 filas (defecto: el ajuste global en L-V).
create or replace function trg_empresa_jornada_defecto() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into empresa_jornada (empresa_id, dia_semana, horas)
  select new.id, d.n, case when d.n <= 5 then jornada_horas() else 0 end
  from generate_series(1, 7) as d(n)
  on conflict (empresa_id, dia_semana) do nothing;
  return new;
end;
$$;

drop trigger if exists empresa_jornada_defecto on empresa;
create trigger empresa_jornada_defecto after insert on empresa
  for each row execute function trg_empresa_jornada_defecto();

-- -----------------------------------------------------------------------------
-- 2. Helper ÚNICO: jornada del día de una empresa. (Sin fila propia -> defecto global en L-V, 0 en S-D.)
-- -----------------------------------------------------------------------------
create or replace function jornada_del_dia(p_empresa uuid, p_fecha date) returns numeric
language sql stable
as $$
  select coalesce(
    (select ej.horas from empresa_jornada ej
      where ej.empresa_id = p_empresa and ej.dia_semana = extract(isodow from p_fecha)::int),
    case when extract(isodow from p_fecha) <= 5 then jornada_horas() else 0 end
  )
$$;

-- Generalización: laborable = jornada del día > 0 y no festivo (los findes salen solos: S-D = 0).
create or replace function es_laborable(p_fecha date, p_empresa uuid) returns boolean
language sql stable
as $$
  select jornada_del_dia(p_empresa, p_fecha) > 0 and not es_festivo(p_fecha, p_empresa);
$$;

-- Horas requeridas en un rango: SUMA de la jornada de cada día laborable (antes: laborables x jornada plana).
create or replace function horas_requeridas(p_desde date, p_hasta date, p_empresa uuid) returns numeric
language sql stable
as $$
  select coalesce(sum(case when es_laborable(d::date, p_empresa) then jornada_del_dia(p_empresa, d::date) else 0 end), 0)
  from generate_series(p_desde, p_hasta, interval '1 day') d;
$$;

-- Días del mes de una empresa con su jornada y si son laborables: fuente única para los calendarios de la app
-- (sustituye la réplica en TypeScript de es_laborable, que tenía el fin de semana cableado).
create or replace function jornada_dias_mes(p_anio int, p_mes int, p_empresa uuid)
returns table (fecha date, jornada numeric, laborable boolean)
language sql stable
as $$
  select d::date, jornada_del_dia(p_empresa, d::date), es_laborable(d::date, p_empresa)
  from generate_series(make_date(p_anio, p_mes, 1),
                       (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date,
                       interval '1 day') d
  order by d;
$$;

grant execute on function jornada_dias_mes(int, int, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Ausencias en HORAS (misma ventana y mismo recorte por mes que dias_ausencia_en_mes, 014)
-- -----------------------------------------------------------------------------
create or replace function horas_ausencia_en_mes(p_fecha_inicio date, p_fecha_fin date, p_empresa uuid, p_anio int, p_mes int)
returns numeric
language sql stable
as $$
  select coalesce(sum(jornada_del_dia(p_empresa, d::date)), 0)
  from generate_series(
    greatest(p_fecha_inicio, make_date(p_anio, p_mes, 1)),
    least(p_fecha_fin, (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date),
    interval '1 day'
  ) d
  where es_laborable(d::date, p_empresa);
$$;

-- Requeridas efectivas del mes = requeridas - horas de ausencia aprobada. Ámbito: uno mismo y, para admins, su gente
-- (mismo criterio que fte_mes / balance_mes_empleado: admin_puede_ver_empresa). Una sola función para la app propia,
-- la ficha del usuario y el export FTE (antes: días x jornada plana en TypeScript).
create or replace function requeridas_efectivas(p_anio int, p_mes int)
returns table (perfil_id uuid, email text, horas_requeridas numeric, horas_ausencia numeric, requeridas_efectivas numeric)
language sql stable security definer set search_path = public
as $$
  with base as (
    select p.id, p.email,
           horas_requeridas_mes(p_anio, p_mes, p.empresa_id) as hr,
           coalesce((
             select sum(horas_ausencia_en_mes(a.fecha_inicio, a.fecha_fin, p.empresa_id, p_anio, p_mes))
             from ausencia a
             where a.perfil_id = p.id and a.estado = 'aprobada'
               and daterange(a.fecha_inicio, a.fecha_fin, '[]')
                   && daterange(make_date(p_anio, p_mes, 1), (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date, '[]')
           ), 0) as ha
    from perfil p
    where p.id = auth.uid()
       or (auth_rol() in ('admin_grupo', 'admin_empresa') and admin_puede_ver_empresa(p.empresa_id))
  )
  select id, email, hr, ha, hr - ha from base;
$$;

grant execute on function requeridas_efectivas(int, int) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Parches demostrados (misma forma de salida y mismos gates que las versiones vigentes)
-- -----------------------------------------------------------------------------
-- faltantes() (002): requerido/falta con la jornada del DÍA (p.id es PK: p.empresa_id es funcionalmente dependiente del GROUP BY).
create or replace function faltantes(p_desde date, p_hasta date)
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
  where p.activo
    and es_laborable(d::date, p.empresa_id)
    and not tiene_ausencia_aprobada(p.id, d::date)
    and (es_admin_grupo() or auth_rol() = 'admin_empresa' or es_responsable_de(p.id))
    and (auth_rol() <> 'admin_empresa' or p.empresa_id = auth_empresa() or es_admin_grupo())
  group by p.id, p.nombre, p.email, d
  having jornada_del_dia(p.empresa_id, d::date) - coalesce(sum(i.horas), 0) > 0
  order by d desc, p.nombre;
$$;

-- faltantes_recordatorio() (012): gemela sin gate de rol, solo service_role (los grants se conservan con create or replace).
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
  where p.activo
    and es_laborable(d::date, p.empresa_id)
    and not tiene_ausencia_aprobada(p.id, d::date)
  group by p.id, p.nombre, p.email, d
  having jornada_del_dia(p.empresa_id, d::date) - coalesce(sum(i.horas), 0) > 0
  order by d desc, p.nombre;
$$;

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
      select json_agg(json_build_object('nombre', nombre, 'imputado', imputado, 'requerido', requerido, 'departamento', departamento) order by (requerido - imputado) desc)
      from base where imputado < requerido
    ), '[]'::json)
  )
  from base;
$$;

-- estado_dias_mes() (011): el requerido de cada persona y día es la jornada de ese día en su empresa.
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
           then jornada_del_dia(e.empresa_id, r.d) else 0 end
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
