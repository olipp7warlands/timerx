-- =============================================================================
-- 013: Mapa del grupo — directorio de áreas y proyectos/marcas del grupo.
-- Lectura para todo authenticated; escritura solo admin_grupo (es un activo
-- de grupo: admin_empresa lee, no edita). "Eliminar" en la UI es baja lógica
-- (activa/activo = false), nunca delete — las lecturas filtran por ellas.
-- =============================================================================

create table mapa_area (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  color   text not null,
  orden   int not null default 0,
  activa  boolean not null default true
);

create table mapa_item (
  id            uuid primary key default gen_random_uuid(),
  area_id       uuid not null references mapa_area(id),
  nombre        text not null,
  etiqueta      text,
  descripcion   text not null,
  empresa_id    uuid references empresa(id),
  url           text,
  orden         int not null default 0,
  activo        boolean not null default true
);

alter table mapa_area enable row level security;
alter table mapa_item enable row level security;

create policy mapa_area_select on mapa_area for select to authenticated using (true);
create policy mapa_area_admin  on mapa_area for all    to authenticated using (es_admin_grupo()) with check (es_admin_grupo());

create policy mapa_item_select on mapa_item for select to authenticated using (true);
create policy mapa_item_admin  on mapa_item for all    to authenticated using (es_admin_grupo()) with check (es_admin_grupo());
