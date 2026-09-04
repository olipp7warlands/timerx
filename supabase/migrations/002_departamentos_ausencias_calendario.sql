-- =============================================================================
-- 002_departamentos_ausencias_calendario.sql
-- Horas Grupo · Extiende 001_esquema_inicial.sql con lo validado en los mockups:
--   1. Departamentos con responsable (aprueba ausencias, vigila faltantes)
--   2. Calendario laboral: festivos con ámbito y ajustes globales (jornada, topes)
--   3. Ausencias con tipo y flujo pendiente → aprobada/rechazada/cancelada
--   4. Funciones de control: días laborables, horas requeridas, faltantes, FTE
-- Requiere PostgreSQL 15+ (Supabase). Ejecutar tras la 001.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEPARTAMENTOS
-- -----------------------------------------------------------------------------
create table departamento (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null unique,
  responsable_id  uuid references perfil(id),   -- aprueba ausencias de su equipo
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table perfil add column departamento_id uuid references departamento(id);

create index idx_perfil_departamento on perfil(departamento_id);

-- ¿Es el usuario actual responsable del departamento de este perfil?
create or replace function es_responsable_de(p_perfil uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from perfil p
    join departamento d on d.id = p.departamento_id
    where p.id = p_perfil and d.responsable_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. CALENDARIO LABORAL: AJUSTES Y FESTIVOS
-- -----------------------------------------------------------------------------
-- Ajustes globales del grupo (clave/valor). Los usa el frontend y las funciones.
create table ajuste (
  clave  text primary key,
  valor  jsonb not null
);

insert into ajuste (clave, valor) values
  ('jornada_horas',           '7'),
  ('tope_horas_dia',          '12'),
  ('descripcion_obligatoria', 'true'),
  ('bloquear_meses_cerrados', 'true'),
  ('recordatorio_email',      'false');

create or replace function jornada_horas() returns numeric
language sql stable
as $$ select coalesce((select (valor #>> '{}')::numeric from ajuste where clave = 'jornada_horas'), 7) $$;

-- Festivos. empresa_id null = todo el grupo; con valor = solo esa empresa.
create table festivo (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  nombre      text not null,
  empresa_id  uuid references empresa(id) on delete cascade,
  unique nulls not distinct (fecha, empresa_id)
);

create index idx_festivo_fecha on festivo(fecha);

create or replace function es_festivo(p_fecha date, p_empresa uuid) returns boolean
language sql stable
as $$
  select exists (
    select 1 from festivo
    where fecha = p_fecha and (empresa_id is null or empresa_id = p_empresa)
  );
$$;

-- Laborable = lunes a viernes y no festivo (del grupo o de la empresa del empleado).
create or replace function es_laborable(p_fecha date, p_empresa uuid) returns boolean
language sql stable
as $$
  select extract(isodow from p_fecha) <= 5 and not es_festivo(p_fecha, p_empresa);
$$;

-- Horas requeridas en un rango para una empresa: laborables x jornada.
create or replace function horas_requeridas(p_desde date, p_hasta date, p_empresa uuid) returns numeric
language sql stable
as $$
  select coalesce(count(*) filter (where es_laborable(d::date, p_empresa)), 0) * jornada_horas()
  from generate_series(p_desde, p_hasta, interval '1 day') d;
$$;

create or replace function horas_requeridas_mes(p_anio int, p_mes int, p_empresa uuid) returns numeric
language sql stable
as $$
  select horas_requeridas(
    make_date(p_anio, p_mes, 1),
    (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date,
    p_empresa
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. AUSENCIAS
-- -----------------------------------------------------------------------------
create type tipo_ausencia   as enum ('vacaciones', 'baja_medica', 'otro_permiso');
create type estado_ausencia as enum ('pendiente', 'aprobada', 'rechazada', 'cancelada');

create table ausencia (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references perfil(id) on delete cascade,
  tipo           tipo_ausencia not null,
  fecha_inicio   date not null,
  fecha_fin      date not null,
  comentario     text,
  estado         estado_ausencia not null default 'pendiente',
  resuelta_por   uuid references perfil(id),
  resuelta_at    timestamptz,
  motivo_rechazo text,
  created_at     timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index idx_ausencia_perfil on ausencia(perfil_id, estado);
create index idx_ausencia_rango  on ausencia(fecha_inicio, fecha_fin);

-- Sin solapes: una persona no puede tener dos ausencias vivas sobre el mismo día.
create or replace function trg_ausencia_validar() returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from ausencia a
    where a.perfil_id = new.perfil_id
      and a.id <> coalesce(new.id, gen_random_uuid())
      and a.estado in ('pendiente', 'aprobada')
      and daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(new.fecha_inicio, new.fecha_fin, '[]')
  ) then
    raise exception 'Ya existe una ausencia pendiente o aprobada que solapa esas fechas';
  end if;
  return new;
end;
$$;

create trigger ausencia_validar
  before insert or update of fecha_inicio, fecha_fin, estado on ausencia
  for each row when (new.estado in ('pendiente', 'aprobada'))
  execute function trg_ausencia_validar();

-- ¿Tiene el perfil una ausencia aprobada que cubra la fecha?
create or replace function tiene_ausencia_aprobada(p_perfil uuid, p_fecha date) returns boolean
language sql stable
as $$
  select exists (
    select 1 from ausencia
    where perfil_id = p_perfil and estado = 'aprobada'
      and p_fecha between fecha_inicio and fecha_fin
  );
$$;

-- No se puede imputar sobre un día con ausencia aprobada.
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

create trigger imputacion_sin_ausencia
  before insert or update of fecha on imputacion
  for each row execute function trg_imputacion_sin_ausencia();

-- ¿Puede el usuario actual resolver (aprobar/rechazar) esta ausencia?
-- admin_grupo, admin de la empresa del solicitante, o responsable de su departamento.
create or replace function puede_resolver_ausencia(p_ausencia uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from ausencia a
    join perfil p on p.id = a.perfil_id
    where a.id = p_ausencia
      and (
        es_admin_grupo()
        or (auth_rol() = 'admin_empresa' and p.empresa_id = auth_empresa())
        or es_responsable_de(p.id)
      )
  );
$$;

-- RPCs del flujo -------------------------------------------------------------
create or replace function solicitar_ausencia(
  p_tipo tipo_ausencia, p_inicio date, p_fin date, p_comentario text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into ausencia (perfil_id, tipo, fecha_inicio, fecha_fin, comentario)
  values (auth.uid(), p_tipo, p_inicio, p_fin, p_comentario)
  returning id into v_id;
  return v_id;
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
  -- Los borradores del empleado en esos días dejan de tener sentido.
  delete from imputacion i
  using ausencia a
  where a.id = p_id
    and i.empleado_id = a.perfil_id
    and i.estado = 'borrador'
    and i.fecha between a.fecha_inicio and a.fecha_fin;
end;
$$;

create or replace function rechazar_ausencia(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not puede_resolver_ausencia(p_id) then
    raise exception 'Sin permiso para resolver esta ausencia';
  end if;
  update ausencia
     set estado = 'rechazada', resuelta_por = auth.uid(), resuelta_at = now(), motivo_rechazo = p_motivo
   where id = p_id and estado = 'pendiente';
  if not found then
    raise exception 'La ausencia no existe o no está pendiente';
  end if;
end;
$$;

create or replace function cancelar_ausencia(p_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update ausencia
     set estado = 'cancelada', resuelta_at = now()
   where id = p_id and perfil_id = auth.uid() and estado = 'pendiente';
  if not found then
    raise exception 'Solo puedes cancelar tus propias solicitudes pendientes';
  end if;
end;
$$;

-- Días efectivos (laborables para la empresa del empleado) de cada ausencia.
create or replace view v_ausencia_dias as
select a.*,
       (select count(*)
          from generate_series(a.fecha_inicio, a.fecha_fin, interval '1 day') d
         where es_laborable(d::date, p.empresa_id))::int as dias_laborables
from ausencia a
join perfil p on p.id = a.perfil_id;

-- -----------------------------------------------------------------------------
-- 4. CONTROL: FALTANTES Y BASE DEL INFORME FTE
-- -----------------------------------------------------------------------------
-- Días laborables pasados sin completar, por empleado. Excluye días con ausencia
-- aprobada. Visible para admins (todo) y responsables (su departamento).
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

-- Base del Excel FTE mensual: una fila por empleado y proyecto, con requeridas
-- y días de ausencia del mes. Las columnas FTE se derivan en el frontend/export.
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

-- -----------------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------------
alter table departamento enable row level security;
alter table ajuste       enable row level security;
alter table festivo      enable row level security;
alter table ausencia     enable row level security;

create policy departamento_select on departamento for select to authenticated using (true);
create policy departamento_admin  on departamento for all to authenticated
  using (es_admin_grupo() or auth_rol() = 'admin_empresa')
  with check (es_admin_grupo() or auth_rol() = 'admin_empresa');

create policy ajuste_select on ajuste for select to authenticated using (true);
create policy ajuste_admin  on ajuste for all to authenticated using (es_admin_grupo()) with check (es_admin_grupo());

create policy festivo_select on festivo for select to authenticated using (true);
create policy festivo_admin  on festivo for all to authenticated
  using (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()))
  with check (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()));

-- Ausencias: cada uno ve las suyas; responsables ven su departamento; admins según ámbito.
create policy ausencia_select on ausencia for select to authenticated
  using (
    perfil_id = auth.uid()
    or es_admin_grupo()
    or (auth_rol() = 'admin_empresa'
        and exists (select 1 from perfil p where p.id = ausencia.perfil_id and p.empresa_id = auth_empresa()))
    or es_responsable_de(perfil_id)
  );

-- Los cambios de estado pasan por los RPC (security definer): sin escritura directa.
create policy ausencia_insert_propia on ausencia for insert to authenticated
  with check (perfil_id = auth.uid() and estado = 'pendiente');

grant execute on function solicitar_ausencia(tipo_ausencia, date, date, text) to authenticated;
grant execute on function aprobar_ausencia(uuid) to authenticated;
grant execute on function rechazar_ausencia(uuid, text) to authenticated;
grant execute on function cancelar_ausencia(uuid) to authenticated;
grant execute on function faltantes(date, date) to authenticated;
grant execute on function fte_mes(int, int) to authenticated;

-- Festivos de arranque (España 2026, ámbito grupo) --------------------------------
insert into festivo (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-06', 'Epifanía'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Fiesta del Trabajo'),
  ('2026-08-15', 'Asunción'),
  ('2026-10-12', 'Fiesta Nacional'),
  ('2026-12-08', 'Inmaculada'),
  ('2026-12-25', 'Navidad');
