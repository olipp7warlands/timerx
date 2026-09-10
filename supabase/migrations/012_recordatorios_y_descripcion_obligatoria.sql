-- =============================================================================
-- 012_recordatorios_y_descripcion_obligatoria.sql
-- F6 Bloque A:
--   1. faltantes_recordatorio(): faltantes() no se puede invocar desde un cron
--      sin sesión de usuario -- su propio cuerpo filtra con auth_rol(), que es
--      `select rol from perfil where id = auth.uid()`; sin JWT de usuario
--      (service_role puro) auth.uid() es null y el gate da 0 filas siempre.
--      Función gemela sin ese gate, exclusiva para service_role.
--   2. Guarda anti-spam de recordatorios (perfil.ultimo_recordatorio_en) y
--      tabla de verificación (recordatorio_log) -- permiten comprobar que el
--      mecanismo funciona sin depender de leer una bandeja de Resend.
--   3. descripcion_obligatoria() real: el ajuste ya existía (002) con toggle
--      en el panel, pero nunca se aplicaba. SOLO se comprueba en INSERT --
--      toda imputación existente (seed incluido) tiene descripcion null; si
--      el check aplicara también a UPDATE, ajustar horas/enviar/aprobar/
--      rechazar/cerrar sobre cualquier línea legada fallaría en flujo normal.
--      Ningún camino de la app toca `descripcion` en un UPDATE hoy.
-- =============================================================================

create or replace function faltantes_recordatorio(p_desde date, p_hasta date)
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
  group by p.id, p.nombre, p.email, d
  having jornada_horas() - coalesce(sum(i.horas), 0) > 0
  order by d desc, p.nombre;
$$;

revoke all on function faltantes_recordatorio(date, date) from public, anon, authenticated;
grant execute on function faltantes_recordatorio(date, date) to service_role;

alter table perfil add column if not exists ultimo_recordatorio_en timestamptz;

-- Registro de lo que se envió/hubiera enviado -- escriben ambos modos (log y
-- real) desde el servidor con service_role; sin políticas de authenticated,
-- no hay UI que la lea todavía.
create table recordatorio_log (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references perfil(id),
  fecha_desde    date not null,
  fecha_hasta    date not null,
  dias_faltantes jsonb not null,
  modo           text not null check (modo in ('log', 'real')),
  creado_en      timestamptz not null default now()
);
alter table recordatorio_log enable row level security;

create or replace function descripcion_obligatoria() returns boolean
language sql stable
as $$ select coalesce((select (valor #>> '{}')::boolean from ajuste where clave = 'descripcion_obligatoria'), true) $$;

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

  -- Descripción obligatoria (012) -- solo en INSERT, ver cabecera del archivo.
  if tg_op = 'INSERT' and descripcion_obligatoria() and (new.descripcion is null or btrim(new.descripcion) = '') then
    raise exception 'La descripción es obligatoria para esta imputación';
  end if;

  return new;
end;
$$;
