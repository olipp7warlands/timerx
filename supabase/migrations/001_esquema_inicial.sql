-- =============================================================================
-- 001_esquema_inicial.sql
-- Control de horas por empresa y proyecto para refacturación intragrupo
-- Supabase (PostgreSQL 15+). Ejecutar en el SQL Editor o vía supabase db push.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TIPOS
-- -----------------------------------------------------------------------------
create type rol_usuario as enum ('admin_grupo', 'admin_empresa', 'responsable_proyecto', 'empleado');
create type estado_imputacion as enum ('borrador', 'enviada', 'aprobada', 'rechazada', 'cerrada');
create type estado_periodo as enum ('abierto', 'cerrado');

-- -----------------------------------------------------------------------------
-- 2. MAESTROS
-- -----------------------------------------------------------------------------
create table empresa (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  cif         text unique,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table proyecto (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresa(id),
  codigo        text not null,
  nombre        text not null,
  activo        boolean not null default true,
  fecha_inicio  date,
  fecha_fin     date,
  created_at    timestamptz not null default now(),
  unique (empresa_id, codigo),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create table categoria (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  activa  boolean not null default true
);

create table subcategoria (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references categoria(id),
  nombre        text not null,
  activa        boolean not null default true,
  unique (categoria_id, nombre)
);

-- -----------------------------------------------------------------------------
-- 3. USUARIOS Y ASIGNACIONES
-- -----------------------------------------------------------------------------
-- Un perfil por usuario de auth. empresa_id = empresa empleadora (origen del servicio).
create table perfil (
  id             uuid primary key references auth.users(id) on delete cascade,
  empresa_id     uuid not null references empresa(id),
  nombre         text not null,
  email          text not null unique,
  rol            rol_usuario not null default 'empleado',
  categoria_id   uuid references categoria(id),          -- categoría por defecto para tarifa y prefill
  max_horas_dia  numeric(4,2) not null default 12 check (max_horas_dia > 0 and max_horas_dia <= 24),
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Proyectos en los que un empleado puede imputar (acota los selectores).
create table empleado_proyecto (
  empleado_id  uuid not null references perfil(id) on delete cascade,
  proyecto_id  uuid not null references proyecto(id) on delete cascade,
  desde        date not null default current_date,
  hasta        date,
  primary key (empleado_id, proyecto_id)
);

-- Responsables de proyecto (pueden ver las horas de su proyecto).
create table proyecto_responsable (
  proyecto_id  uuid not null references proyecto(id) on delete cascade,
  perfil_id    uuid not null references perfil(id) on delete cascade,
  primary key (proyecto_id, perfil_id)
);

-- -----------------------------------------------------------------------------
-- 4. TARIFAS (flexible: por categoría o por empleado, con vigencia)
-- -----------------------------------------------------------------------------
create table tarifa (
  id                 uuid primary key default gen_random_uuid(),
  categoria_id       uuid references categoria(id),
  empleado_id        uuid references perfil(id),
  empresa_origen_id  uuid references empresa(id),       -- null = aplica a todas las empresas origen
  coste_hora         numeric(10,2) not null check (coste_hora >= 0),
  moneda             char(3) not null default 'EUR',
  vigente_desde      date not null,
  vigente_hasta      date,
  check (num_nonnulls(categoria_id, empleado_id) = 1),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create index tarifa_categoria_idx on tarifa (categoria_id, vigente_desde);
create index tarifa_empleado_idx  on tarifa (empleado_id, vigente_desde);

-- Resuelve la tarifa aplicable. Prioridad: empleado > categoría; con empresa origen > genérica; más reciente.
create or replace function resolver_tarifa(
  p_empleado uuid, p_categoria uuid, p_empresa_origen uuid, p_fecha date
) returns numeric
language sql stable
as $$
  select coste_hora
  from tarifa t
  where p_fecha >= t.vigente_desde
    and (t.vigente_hasta is null or p_fecha <= t.vigente_hasta)
    and (t.empleado_id = p_empleado or t.categoria_id = p_categoria)
    and (t.empresa_origen_id is null or t.empresa_origen_id = p_empresa_origen)
  order by
    (t.empleado_id is not null) desc,
    (t.empresa_origen_id is not null) desc,
    t.vigente_desde desc
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 5. PERIODOS DE CIERRE (por empresa destino y mes)
-- -----------------------------------------------------------------------------
create table periodo (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),   -- empresa destino (la que paga)
  anio         int not null check (anio between 2000 and 2100),
  mes          int not null check (mes between 1 and 12),
  estado       estado_periodo not null default 'abierto',
  cerrado_por  uuid references perfil(id),
  cerrado_en   timestamptz,
  unique (empresa_id, anio, mes)
);

create or replace function periodo_cerrado(p_empresa uuid, p_fecha date) returns boolean
language sql stable
as $$
  select exists (
    select 1 from periodo
    where empresa_id = p_empresa
      and anio = extract(year from p_fecha)::int
      and mes  = extract(month from p_fecha)::int
      and estado = 'cerrado'
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. IMPUTACIONES (la tabla central)
-- -----------------------------------------------------------------------------
create table imputacion (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references perfil(id),
  proyecto_id      uuid not null references proyecto(id),
  subcategoria_id  uuid not null references subcategoria(id),
  fecha            date not null,
  horas            numeric(4,2) not null check (horas > 0 and horas <= 24),
  descripcion      text,
  estado           estado_imputacion not null default 'borrador',
  aprobado_por     uuid references perfil(id),
  aprobado_en      timestamptz,
  motivo_rechazo   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index imputacion_empleado_fecha_idx on imputacion (empleado_id, fecha);
create index imputacion_proyecto_fecha_idx on imputacion (proyecto_id, fecha);
create index imputacion_estado_idx         on imputacion (estado);

-- Validaciones de negocio antes de insertar / actualizar.
create or replace function imputacion_validar() returns trigger
language plpgsql
as $$
declare
  v_empresa_destino uuid;
  v_max_horas       numeric;
  v_total_dia       numeric;
begin
  new.updated_at := now();

  -- Una imputación cerrada es inmutable.
  if tg_op = 'UPDATE' and old.estado = 'cerrada' then
    raise exception 'La imputación % está cerrada y no puede modificarse', old.id;
  end if;

  -- Proyecto activo y empleado asignado a él.
  select empresa_id into v_empresa_destino from proyecto where id = new.proyecto_id and activo;
  if v_empresa_destino is null then
    raise exception 'El proyecto no existe o no está activo';
  end if;

  if not exists (
    select 1 from empleado_proyecto ep
    where ep.empleado_id = new.empleado_id and ep.proyecto_id = new.proyecto_id
      and new.fecha >= ep.desde and (ep.hasta is null or new.fecha <= ep.hasta)
  ) then
    raise exception 'El empleado no está asignado a este proyecto en la fecha indicada';
  end if;

  -- Subcategoría activa.
  if not exists (select 1 from subcategoria where id = new.subcategoria_id and activa) then
    raise exception 'La subcategoría no está activa';
  end if;

  -- Periodo cerrado en la empresa destino.
  if periodo_cerrado(v_empresa_destino, new.fecha) then
    raise exception 'El periodo de % está cerrado para la empresa destino', to_char(new.fecha, 'MM/YYYY');
  end if;

  -- Máximo de horas por día.
  select max_horas_dia into v_max_horas from perfil where id = new.empleado_id;
  select coalesce(sum(horas), 0) into v_total_dia
  from imputacion
  where empleado_id = new.empleado_id and fecha = new.fecha
    and estado <> 'rechazada'
    and (tg_op = 'INSERT' or id <> new.id);

  if v_total_dia + new.horas > v_max_horas then
    raise exception 'Supera el máximo de % horas para el día % (ya imputadas: %)', v_max_horas, new.fecha, v_total_dia;
  end if;

  return new;
end;
$$;

create trigger imputacion_validar_trg
  before insert or update on imputacion
  for each row execute function imputacion_validar();

-- -----------------------------------------------------------------------------
-- 7. VISTAS DE REPORTING Y REFACTURACIÓN
-- -----------------------------------------------------------------------------
-- Cada imputación con empresa origen/destino, categoría, tarifa e importe.
create or replace view v_imputacion_valorada as
select
  i.id,
  i.fecha,
  extract(year  from i.fecha)::int as anio,
  extract(month from i.fecha)::int as mes,
  i.empleado_id,
  pe.nombre            as empleado,
  pe.empresa_id        as empresa_origen_id,
  eo.nombre            as empresa_origen,
  pr.empresa_id        as empresa_destino_id,
  ed.nombre            as empresa_destino,
  i.proyecto_id,
  pr.codigo            as proyecto_codigo,
  pr.nombre            as proyecto,
  c.id                 as categoria_id,
  c.nombre             as categoria,
  s.id                 as subcategoria_id,
  s.nombre             as subcategoria,
  i.horas,
  i.estado,
  i.descripcion,
  resolver_tarifa(i.empleado_id, c.id, pe.empresa_id, i.fecha) as coste_hora,
  round(i.horas * coalesce(resolver_tarifa(i.empleado_id, c.id, pe.empresa_id, i.fecha), 0), 2) as importe,
  (pe.empresa_id <> pr.empresa_id) as es_intragrupo
from imputacion i
join perfil       pe on pe.id = i.empleado_id
join empresa      eo on eo.id = pe.empresa_id
join proyecto     pr on pr.id = i.proyecto_id
join empresa      ed on ed.id = pr.empresa_id
join subcategoria s  on s.id = i.subcategoria_id
join categoria    c  on c.id = s.categoria_id;

-- Resumen mensual origen -> destino -> categoría (solo horas aprobadas o cerradas).
create or replace view v_refacturacion_mensual as
select
  anio, mes,
  empresa_origen_id, empresa_origen,
  empresa_destino_id, empresa_destino,
  proyecto_id, proyecto_codigo, proyecto,
  categoria_id, categoria,
  sum(horas)   as horas,
  sum(importe) as importe,
  count(*)     as lineas,
  bool_and(coste_hora is not null) as tarifa_completa
from v_imputacion_valorada
where estado in ('aprobada', 'cerrada') and es_intragrupo
group by 1,2,3,4,5,6,7,8,9,10,11;

-- -----------------------------------------------------------------------------
-- 8. HELPERS DE SEGURIDAD
-- -----------------------------------------------------------------------------
create or replace function auth_rol() returns rol_usuario
language sql stable security definer set search_path = public
as $$ select rol from perfil where id = auth.uid() $$;

create or replace function auth_empresa() returns uuid
language sql stable security definer set search_path = public
as $$ select empresa_id from perfil where id = auth.uid() $$;

create or replace function es_admin_grupo() returns boolean
language sql stable
as $$ select auth_rol() = 'admin_grupo' $$;

-- Empresa destino de un proyecto (para políticas).
create or replace function empresa_de_proyecto(p_proyecto uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select empresa_id from proyecto where id = p_proyecto $$;

-- -----------------------------------------------------------------------------
-- 9. FLUJO DE APROBACIÓN Y CIERRE (RPC)
-- -----------------------------------------------------------------------------
-- El empleado envía sus imputaciones a aprobación.
create or replace function enviar_imputaciones(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  update imputacion
     set estado = 'enviada'
   where id = any(p_ids)
     and empleado_id = auth.uid()
     and estado in ('borrador', 'rechazada');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Aprueba el admin de la empresa destino (o admin de grupo).
create or replace function aprobar_imputaciones(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  if auth_rol() not in ('admin_grupo', 'admin_empresa') then
    raise exception 'Sin permisos para aprobar';
  end if;

  update imputacion i
     set estado = 'aprobada', aprobado_por = auth.uid(), aprobado_en = now(), motivo_rechazo = null
   where i.id = any(p_ids)
     and i.estado = 'enviada'
     and (es_admin_grupo() or empresa_de_proyecto(i.proyecto_id) = auth_empresa());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function rechazar_imputaciones(p_ids uuid[], p_motivo text) returns int
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  if auth_rol() not in ('admin_grupo', 'admin_empresa') then
    raise exception 'Sin permisos para rechazar';
  end if;

  update imputacion i
     set estado = 'rechazada', motivo_rechazo = p_motivo, aprobado_por = auth.uid(), aprobado_en = now()
   where i.id = any(p_ids)
     and i.estado = 'enviada'
     and (es_admin_grupo() or empresa_de_proyecto(i.proyecto_id) = auth_empresa());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Cierra un mes para una empresa destino: exige que no queden líneas pendientes.
create or replace function cerrar_periodo(p_empresa uuid, p_anio int, p_mes int) returns void
language plpgsql security definer set search_path = public
as $$
declare v_pendientes int;
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
-- 10. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table empresa              enable row level security;
alter table proyecto             enable row level security;
alter table categoria            enable row level security;
alter table subcategoria         enable row level security;
alter table perfil               enable row level security;
alter table empleado_proyecto    enable row level security;
alter table proyecto_responsable enable row level security;
alter table tarifa               enable row level security;
alter table periodo              enable row level security;
alter table imputacion           enable row level security;

-- Maestros: lectura para todos los autenticados, escritura admin de grupo
-- (admin de empresa puede gestionar los proyectos de su empresa).
create policy empresa_select on empresa for select to authenticated using (true);
create policy empresa_admin  on empresa for all    to authenticated using (es_admin_grupo()) with check (es_admin_grupo());

create policy proyecto_select on proyecto for select to authenticated using (true);
create policy proyecto_admin  on proyecto for all to authenticated
  using (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()))
  with check (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()));

create policy categoria_select on categoria for select to authenticated using (true);
create policy categoria_admin  on categoria for all to authenticated using (es_admin_grupo()) with check (es_admin_grupo());

create policy subcategoria_select on subcategoria for select to authenticated using (true);
create policy subcategoria_admin  on subcategoria for all to authenticated using (es_admin_grupo()) with check (es_admin_grupo());

-- Perfiles: uno mismo, admin de empresa ve los suyos, admin de grupo todos.
create policy perfil_select on perfil for select to authenticated
  using (id = auth.uid() or es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()));
create policy perfil_update_admin on perfil for update to authenticated
  using (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()))
  with check (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()));
create policy perfil_insert_admin on perfil for insert to authenticated
  with check (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_id = auth_empresa()));

-- Asignaciones: el empleado ve las suyas; gestionan admins.
create policy ep_select on empleado_proyecto for select to authenticated
  using (empleado_id = auth.uid() or auth_rol() in ('admin_grupo', 'admin_empresa'));
create policy ep_admin on empleado_proyecto for all to authenticated
  using (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_de_proyecto(proyecto_id) = auth_empresa()))
  with check (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_de_proyecto(proyecto_id) = auth_empresa()));

create policy pr_select on proyecto_responsable for select to authenticated using (true);
create policy pr_admin  on proyecto_responsable for all to authenticated
  using (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_de_proyecto(proyecto_id) = auth_empresa()))
  with check (es_admin_grupo() or (auth_rol() = 'admin_empresa' and empresa_de_proyecto(proyecto_id) = auth_empresa()));

-- Tarifas: solo admins ven y solo admin de grupo edita.
create policy tarifa_select on tarifa for select to authenticated using (auth_rol() in ('admin_grupo', 'admin_empresa'));
create policy tarifa_admin  on tarifa for all    to authenticated using (es_admin_grupo()) with check (es_admin_grupo());

-- Periodos: lectura general; escritura solo vía cerrar_periodo() (security definer).
create policy periodo_select on periodo for select to authenticated using (true);

-- Imputaciones.
create policy imputacion_select on imputacion for select to authenticated
  using (
    empleado_id = auth.uid()
    or es_admin_grupo()
    or (auth_rol() = 'admin_empresa' and (
          empresa_de_proyecto(proyecto_id) = auth_empresa()
          or exists (select 1 from perfil p where p.id = imputacion.empleado_id and p.empresa_id = auth_empresa())))
    or exists (select 1 from proyecto_responsable r where r.proyecto_id = imputacion.proyecto_id and r.perfil_id = auth.uid())
  );

create policy imputacion_insert on imputacion for insert to authenticated
  with check (empleado_id = auth.uid() and estado = 'borrador');

create policy imputacion_update_propia on imputacion for update to authenticated
  using (empleado_id = auth.uid() and estado in ('borrador', 'rechazada'))
  with check (empleado_id = auth.uid() and estado in ('borrador', 'rechazada'));

create policy imputacion_delete_propia on imputacion for delete to authenticated
  using (empleado_id = auth.uid() and estado in ('borrador', 'rechazada'));

create policy imputacion_admin_grupo on imputacion for all to authenticated
  using (es_admin_grupo()) with check (es_admin_grupo());

-- -----------------------------------------------------------------------------
-- 11. ALTA AUTOMÁTICA DE PERFIL AL CREAR USUARIO EN AUTH
-- -----------------------------------------------------------------------------
-- Requiere que la invitación incluya empresa_id en raw_user_meta_data.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into perfil (id, empresa_id, nombre, email, rol)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'empresa_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'rol')::rol_usuario, 'empleado')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
