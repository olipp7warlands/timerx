-- =============================================================================
-- 030: v2.0 (parte ADITIVA) — Empresa → Departamentos → Especialidades
--
-- Modelo destino: DOS niveles. Departamento (agrupador, con color) → Especialidad (la unidad IMPUTABLE = la actual
-- `subcategoria`). El nivel intermedio `categoria` deja de ser un concepto: queda como ESPEJO 1:1 de su departamento
-- (D3 del plan: el camino del dinero —tarifa, resolver_tarifa, v_imputacion_valorada, v_refacturacion_mensual y
-- cerrar_periodo— NO se reescribe; sigue colgando de categoria, que ahora es «el departamento por dentro»).
--
-- Esta migración NO cambia ningún comportamiento visible y es COMPATIBLE con la app v1.7 (se puede dejar puesta días antes
-- de la 031, que es la de conmutación). Solo añade:
--   1. departamento.color            clave de paleta (12 claves; el mapa de grupos actual pasa a ser estas claves). NULL permitido.
--   2. empresa_departamento (M:N)    qué departamentos EXISTEN en cada empresa. Escritura: admin_grupo (como toda la estructura).
--   3. perfil_departamento           opcional: conjunto EXACTO de departamentos cuyas especialidades puede imputar un
--                                    profesional (acota o amplía, D6). Vacío = todos los de su empresa.
--                                    Escritura: admin_grupo y admin_empresa sobre los no-admin de SU empresa (misma regla que 022).
--   4. Trigger del espejo (C1)       crear / renombrar / desactivar un departamento crea / renombra / desactiva su categoría
--                                    espejo EN LA MISMA TRANSACCIÓN: un departamento nuevo sin espejo dejaría a tarifas y cierre
--                                    sin su clave.
--   5. Backfill: todo departamento sin ninguna categoría recibe su espejo.
--
-- Privilegios (normas K/L, 023/024): tablas nuevas cerradas a anon/public y concedidas explícitamente; función de trigger sin EXECUTE
-- para nadie (los triggers corren igualmente). Autocomprobación final: si algo no queda así, la migración entera se revierte.
-- =============================================================================

-- 1. Color del departamento (clave de paleta; los valores claro/oscuro viven en la app).
alter table departamento add column color text;
alter table departamento add constraint departamento_color_check
  check (color is null or color in ('azul', 'arena', 'malva', 'verde', 'turquesa', 'rosa', 'oliva', 'indigo', 'terracota', 'ocre', 'pizarra', 'granate'));

-- 2. Departamentos que existen en cada empresa.
create table empresa_departamento (
  empresa_id       uuid not null references empresa(id) on delete cascade,
  departamento_id  uuid not null references departamento(id) on delete cascade,
  primary key (empresa_id, departamento_id)
);
create index empresa_departamento_departamento_idx on empresa_departamento (departamento_id);

alter table empresa_departamento enable row level security;
create policy empresa_departamento_select on empresa_departamento for select to authenticated using (true);
create policy empresa_departamento_admin  on empresa_departamento for all to authenticated
  using (es_admin_grupo()) with check (es_admin_grupo());

-- 3. Conjunto exacto de departamentos visibles al imputar, por profesional (opcional).
create table perfil_departamento (
  perfil_id        uuid not null references perfil(id) on delete cascade,
  departamento_id  uuid not null references departamento(id) on delete cascade,
  primary key (perfil_id, departamento_id)
);
create index perfil_departamento_departamento_idx on perfil_departamento (departamento_id);

alter table perfil_departamento enable row level security;
-- Lectura: el propio profesional (su selector lo necesita), admin_grupo, y admin_empresa sobre su empresa.
create policy perfil_departamento_select on perfil_departamento for select to authenticated
  using (
    perfil_id = auth.uid()
    or es_admin_grupo()
    or (auth_rol() = 'admin_empresa' and exists (select 1 from perfil p where p.id = perfil_id and p.empresa_id = auth_empresa()))
  );
-- Escritura (D7): admin_grupo; admin_empresa solo sobre profesionales no-admin de SU empresa (misma frontera que perfil_update_admin, 022).
create policy perfil_departamento_admin on perfil_departamento for all to authenticated
  using (
    es_admin_grupo()
    or (auth_rol() = 'admin_empresa'
        and exists (select 1 from perfil p where p.id = perfil_id and p.empresa_id = auth_empresa() and p.rol in ('empleado', 'responsable_proyecto')))
  )
  with check (
    es_admin_grupo()
    or (auth_rol() = 'admin_empresa'
        and exists (select 1 from perfil p where p.id = perfil_id and p.empresa_id = auth_empresa() and p.rol in ('empleado', 'responsable_proyecto')))
  );

-- Privilegios: cerrar a anon/public (los defaults de Supabase los abren) y conceder lo justo; la RLS decide quién y qué filas.
revoke all on empresa_departamento, perfil_departamento from public, anon, authenticated;
grant select, insert, update, delete on empresa_departamento, perfil_departamento to authenticated;

-- 4. Ciclo de vida del espejo (C1). Misma transacción que la escritura del departamento.
--    `app.v20_sin_espejo = 'on'` (solo la 031) permite enlazar un espejo ya existente en vez de crear uno nuevo.
create or replace function departamento_espejo() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.v20_sin_espejo', true), '') = 'on' then
      return new;
    end if;
    -- Adopta una categoría huérfana (global) con el mismo nombre si existe; si no, crea el espejo.
    update categoria set departamento_id = new.id, activa = new.activo
     where departamento_id is null and lower(nombre) = lower(new.nombre);
    if not found then
      insert into categoria (nombre, activa, departamento_id) values (new.nombre, new.activo, new.id);
    end if;
  else
    if new.nombre is distinct from old.nombre then
      update categoria set nombre = new.nombre where departamento_id = new.id;
    end if;
    if new.activo is distinct from old.activo then
      update categoria set activa = new.activo where departamento_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger departamento_espejo
  after insert or update of nombre, activo on departamento
  for each row execute function departamento_espejo();

revoke execute on function departamento_espejo() from public, anon, authenticated, service_role;

-- 5. Backfill: todo departamento sin ninguna categoría recibe su espejo (en demo y producción ya lo tienen los 3 actuales).
insert into categoria (nombre, activa, departamento_id)
select d.nombre, d.activo, d.id
from departamento d
where not exists (select 1 from categoria c where c.departamento_id = d.id);

-- -----------------------------------------------------------------------------
-- AUTOCOMPROBACIÓN: si algo no queda como se ha descrito, la migración entera se revierte
-- -----------------------------------------------------------------------------
do $$
declare
  v text;
begin
  -- anon/public sin privilegios en las tablas nuevas
  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('empresa_departamento', 'perfil_departamento')
    and (has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger'));
  if v is not null then raise exception '030: anon conserva privilegios en: %', v; end if;

  -- authenticated: lectura y escritura sujetas a RLS (RLS activada)
  if exists (select 1 from pg_class c where c.relname in ('empresa_departamento', 'perfil_departamento') and not c.relrowsecurity) then
    raise exception '030: RLS sin activar en una tabla nueva';
  end if;
  if not has_table_privilege('authenticated', 'empresa_departamento', 'select, insert, update, delete')
     or not has_table_privilege('authenticated', 'perfil_departamento', 'select, insert, update, delete') then
    raise exception '030: authenticated sin privilegios en las tablas nuevas';
  end if;

  -- la función del trigger no es ejecutable por nadie
  if has_function_privilege('anon', 'departamento_espejo()', 'execute') or has_function_privilege('authenticated', 'departamento_espejo()', 'execute')
     or has_function_privilege('public', 'departamento_espejo()', 'execute') then
    raise exception '030: departamento_espejo() es ejecutable';
  end if;

  -- todo departamento tiene espejo
  select string_agg(d.nombre, ', ') into v from departamento d where not exists (select 1 from categoria c where c.departamento_id = d.id);
  if v is not null then raise exception '030: departamentos sin categoría espejo: %', v; end if;

  -- las tablas nuevas nacen vacías
  if exists (select 1 from empresa_departamento) or exists (select 1 from perfil_departamento) then
    raise exception '030: las tablas nuevas debían nacer vacías';
  end if;
end;
$$;
