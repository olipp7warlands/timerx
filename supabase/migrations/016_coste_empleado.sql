-- =============================================================================
-- 016: coste_empleado -- coste interno por hora de cada empleado, para el
-- control salarial. NO es la tarifa de refacturación (`tarifa`, precio
-- facturable entre empresas): este dato es lo que le cuesta la hora al grupo.
--
-- Versionado por fecha: importar un coste nuevo AÑADE una fila con su `desde`,
-- nunca machaca el histórico. El vigente de un empleado es el de mayor
-- `desde` <= hoy (`v_coste_vigente`). (perfil_id, desde) es único: repetir la
-- misma versión es un error de importación, no un pisado silencioso.
--
-- RLS estricta: lectura Y escritura solo admin_grupo (dato salarial: ni
-- admin_empresa lo ve; si algún día hace falta abrirlo, se decidirá entonces).
-- =============================================================================

create table coste_empleado (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references perfil(id) on delete cascade,
  coste_hora  numeric not null check (coste_hora >= 0),
  desde       date not null,
  creado_en   timestamptz not null default now(),
  unique (perfil_id, desde)
);

create index idx_coste_empleado_perfil on coste_empleado(perfil_id, desde desc);

alter table coste_empleado enable row level security;

create policy coste_empleado_admin_grupo on coste_empleado
  for all to authenticated
  using (es_admin_grupo())
  with check (es_admin_grupo());

revoke all on coste_empleado from anon;

-- Coste vigente por empleado. security_invoker: la RLS de la tabla se aplica a
-- QUIEN CONSULTA (una vista normal correría con los permisos de su dueño y
-- saltaría la política). "Hoy" en hora de Madrid, no UTC.
create view v_coste_vigente with (security_invoker = true) as
select distinct on (perfil_id) perfil_id, coste_hora, desde
from coste_empleado
where desde <= (now() at time zone 'Europe/Madrid')::date
order by perfil_id, desde desc;

revoke all on v_coste_vigente from anon;
