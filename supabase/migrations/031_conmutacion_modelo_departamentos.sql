-- =============================================================================
-- 031: v2.0 (CONMUTACIÓN) — se aplica JUSTO ANTES de promocionar la app v2.0 (decisión D10: misma ventana).
--
-- Con la 030 puesta, esta migración deja el catálogo en el modelo destino sin tocar NI UNA fila de imputacion, subcategoria ni tarifa:
--   · Fusión grupo → departamento: 3B3 → «Desarrollo» (D1), Jurídico → «Legal»; Diseño intacto; Gestión (global) → departamento
--     «Administración y Finanzas» presente en las tres empresas (D2/D4), CON sus tareas intactas para reubicar después desde la UI;
--     Operaciones (global, solo existe en demo) → departamento «Operaciones».
--   · Espejo 1:1 (D3): categoria.departamento_id NOT NULL y UNIQUE. Los nombres del espejo se sincronizan por el trigger de la 030.
--   · empresa_departamento: TODAS las empresas con TODOS los departamentos activos el día 1 (D4): nadie ve menos. El recorte lo decide el admin.
--   · Colores: los 4 grupos de color actuales pasan a claves de paleta (azul/arena/malva/verde) y Operaciones recibe 'turquesa'.
--   · Normalización de perfiles incoherentes (departamento y categoría que apuntan a departamentos distintos): SOLO los declarados abajo
--     (en demo, Sara Martín: 3B3 × Diseño → Diseño, D11). Cualquier otro perfil incoherente ABORTA la migración (C3): nunca se normaliza un
--     perfil que nadie ha revisado.
--
-- Reversa: `respaldo_v20` guarda lo que se cambia; `supabase/rollback/v2.0_down.sql` lo restaura (ensayada en demo).
-- La migración se NIEGA a correr si el catálogo no tiene la forma esperada, y termina con una autocomprobación que revierte TODO si algo no cuadra.
-- =============================================================================

create temp table v20_antes (clave text primary key, valor numeric) on commit drop;

-- Respaldo para la reversa (nadie lo lee salvo el rol de migraciones/service_role).
create table respaldo_v20 (tipo text not null, id uuid, campo text, valor text);
alter table respaldo_v20 enable row level security;
revoke all on respaldo_v20 from public, anon, authenticated;

do $$
declare
  v_dep_3b3 uuid; v_dep_jur uuid; v_dep_dis uuid; v_dep_ayf uuid; v_dep_ope uuid;
  v_cat_ges uuid; v_cat_ope uuid;
  v_declarados text[] := array['sara.martin@wowinx.com'];   -- perfiles incoherentes cuya normalización está APROBADA (D11, solo demo)
  v_extra text;
begin
  -- 1. GUARDAS DE FORMA: el catálogo debe ser exactamente el esperado (3 departamentos; 4 categorías, o 5 con Operaciones global).
  select id into v_dep_3b3 from departamento where nombre = '3B3';
  select id into v_dep_jur from departamento where nombre = 'Jurídico';
  select id into v_dep_dis from departamento where nombre = 'Diseño';
  if v_dep_3b3 is null or v_dep_jur is null or v_dep_dis is null or (select count(*) from departamento) <> 3 then
    raise exception '031: el catálogo de departamentos no es el esperado (3B3, Jurídico, Diseño)';
  end if;
  if not exists (select 1 from categoria where nombre = 'Desarrollo' and departamento_id = v_dep_3b3)
     or not exists (select 1 from categoria where nombre = 'Abogados' and departamento_id = v_dep_jur)
     or not exists (select 1 from categoria where nombre = 'Diseño' and departamento_id = v_dep_dis) then
    raise exception '031: las categorías Desarrollo/Abogados/Diseño no están enlazadas a 3B3/Jurídico/Diseño como se esperaba';
  end if;
  select id into v_cat_ges from categoria where nombre = 'Gestión' and departamento_id is null;
  select id into v_cat_ope from categoria where nombre = 'Operaciones' and departamento_id is null;
  if v_cat_ges is null then raise exception '031: no existe la categoría global «Gestión»'; end if;
  if (select count(*) from categoria) <> 4 + (case when v_cat_ope is null then 0 else 1 end) then
    raise exception '031: hay categorías inesperadas (esperadas: Desarrollo, Abogados, Diseño, Gestión%)', case when v_cat_ope is null then '' else ' y Operaciones' end;
  end if;
  if exists (select 1 from departamento where color is not null) then
    raise exception '031: algún departamento ya tiene color (¿031 aplicada?)';
  end if;

  -- 2. CONTADORES para la autocomprobación (nada de esto debe cambiar)
  insert into v20_antes values
    ('imputacion', (select count(*) from imputacion)), ('subcategoria', (select count(*) from subcategoria)),
    ('tarifa', (select count(*) from tarifa)), ('perfil', (select count(*) from perfil)), ('periodo', (select count(*) from periodo)),
    ('valorada_lineas', (select count(*) from v_imputacion_valorada)), ('valorada_importe', (select coalesce(sum(importe), 0) from v_imputacion_valorada)),
    ('refact_importe', (select coalesce(sum(importe), 0) from v_refacturacion_mensual));

  -- 3. RESPALDO de todo lo que se va a tocar
  insert into respaldo_v20 (tipo, id, campo, valor)
    select 'departamento', id, 'nombre', nombre from departamento
    union all select 'departamento', id, 'color', color from departamento
    union all select 'categoria', id, 'nombre', nombre from categoria
    union all select 'categoria', id, 'departamento_id', departamento_id::text from categoria;

  -- 4. RENOMBRES (el trigger de la 030 sincroniza el nombre del espejo): 3B3 → Desarrollo (D1), Jurídico → Legal
  update departamento set nombre = 'Desarrollo' where id = v_dep_3b3;
  update departamento set nombre = 'Legal' where id = v_dep_jur;

  -- 5. DEPARTAMENTOS NUEVOS enlazando la categoría existente (no se crea un espejo nuevo: Gestión conserva sus tareas)
  perform set_config('app.v20_sin_espejo', 'on', true);
  insert into departamento (nombre, activo) values ('Administración y Finanzas', true) returning id into v_dep_ayf;
  insert into respaldo_v20 (tipo, id, campo, valor) values ('departamento_creado', v_dep_ayf, null, null);
  update categoria set departamento_id = v_dep_ayf, nombre = 'Administración y Finanzas' where id = v_cat_ges;
  if v_cat_ope is not null then
    insert into departamento (nombre, activo) values ('Operaciones', true) returning id into v_dep_ope;
    insert into respaldo_v20 (tipo, id, campo, valor) values ('departamento_creado', v_dep_ope, null, null);
    update categoria set departamento_id = v_dep_ope where id = v_cat_ope;
  end if;
  perform set_config('app.v20_sin_espejo', 'off', true);

  -- 6. COLORES (claves de paleta; los cuatro grupos actuales conservan su tono)
  update departamento set color = 'azul'   where id = v_dep_3b3;
  update departamento set color = 'arena'  where id = v_dep_dis;
  update departamento set color = 'malva'  where id = v_dep_jur;
  update departamento set color = 'verde'  where id = v_dep_ayf;
  if v_dep_ope is not null then update departamento set color = 'turquesa' where id = v_dep_ope; end if;

  -- 7. PERFILES INCOHERENTES (departamento y categoría que apuntan a departamentos distintos). Solo los declarados; el resto ABORTA (C3).
  create temp table v20_incoherentes on commit drop as
    select p.id, p.email, p.departamento_id as dep_anterior, c.departamento_id as dep_nuevo
    from perfil p join categoria c on c.id = p.categoria_id
    where p.departamento_id is not null and c.departamento_id is distinct from p.departamento_id;
  select string_agg(email, ', ') into v_extra from v20_incoherentes where lower(email) <> all (v_declarados);
  if v_extra is not null then
    raise exception '031: perfil(es) incoherente(s) NO declarado(s), nadie ha revisado su normalización: %', v_extra;
  end if;
  insert into respaldo_v20 (tipo, id, campo, valor) select 'perfil', id, 'departamento_id', dep_anterior::text from v20_incoherentes;
  update perfil p set departamento_id = i.dep_nuevo from v20_incoherentes i where p.id = i.id;

  -- 8. D4: todas las empresas con todos los departamentos activos
  insert into empresa_departamento (empresa_id, departamento_id)
    select e.id, d.id from empresa e cross join departamento d where d.activo
  on conflict do nothing;
end;
$$;

-- 9. INVARIANTE DEL ESPEJO: una categoría por departamento, y toda categoría tiene departamento.
alter table categoria alter column departamento_id set not null;
alter table categoria add constraint categoria_departamento_unico unique (departamento_id);

-- -----------------------------------------------------------------------------
-- AUTOCOMPROBACIÓN: si algo no queda como se ha descrito, la migración entera se revierte
-- -----------------------------------------------------------------------------
do $$
declare
  v text;
  r record;
begin
  -- nada de lo imputable ni del dinero se ha movido
  for r in select clave, valor from v20_antes loop
    if r.clave = 'imputacion' and (select count(*) from imputacion) <> r.valor then raise exception '031: cambió el número de imputaciones'; end if;
    if r.clave = 'subcategoria' and (select count(*) from subcategoria) <> r.valor then raise exception '031: cambió el número de subcategorías'; end if;
    if r.clave = 'tarifa' and (select count(*) from tarifa) <> r.valor then raise exception '031: cambió el número de tarifas'; end if;
    if r.clave = 'perfil' and (select count(*) from perfil) <> r.valor then raise exception '031: cambió el número de perfiles'; end if;
    if r.clave = 'periodo' and (select count(*) from periodo) <> r.valor then raise exception '031: cambió el número de periodos'; end if;
    if r.clave = 'valorada_lineas' and (select count(*) from v_imputacion_valorada) <> r.valor then raise exception '031: cambió el número de líneas valoradas'; end if;
    if r.clave = 'valorada_importe' and (select coalesce(sum(importe), 0) from v_imputacion_valorada) <> r.valor then raise exception '031: cambió el importe valorado'; end if;
    if r.clave = 'refact_importe' and (select coalesce(sum(importe), 0) from v_refacturacion_mensual) <> r.valor then raise exception '031: cambió el importe de refacturación'; end if;
  end loop;

  -- espejo 1:1 y nombres sincronizados
  if (select count(*) from categoria) <> (select count(*) from departamento) then raise exception '031: categorías y departamentos no son 1:1'; end if;
  select string_agg(d.nombre, ', ') into v from departamento d join categoria c on c.departamento_id = d.id where c.nombre <> d.nombre or c.activa <> d.activo;
  if v is not null then raise exception '031: espejo desincronizado en: %', v; end if;

  -- D4: todas las empresas con todos los departamentos activos
  if (select count(*) from empresa_departamento) <> (select count(*) from empresa) * (select count(*) from departamento where activo) then
    raise exception '031: empresa_departamento no tiene todas las combinaciones';
  end if;

  -- colores asignados a todos los departamentos
  select string_agg(nombre, ', ') into v from departamento where color is null;
  if v is not null then raise exception '031: departamentos sin color: %', v; end if;

  -- Gestión conserva sus tareas bajo el nuevo departamento
  if (select count(*) from subcategoria s join categoria c on c.id = s.categoria_id join departamento d on d.id = c.departamento_id where d.nombre = 'Administración y Finanzas') < 3 then
    raise exception '031: Administración y Finanzas no conserva las tareas de Gestión';
  end if;

  -- el respaldo no es legible por anon/authenticated
  if has_table_privilege('anon', 'respaldo_v20', 'select') or has_table_privilege('authenticated', 'respaldo_v20', 'select') then
    raise exception '031: respaldo_v20 es legible';
  end if;
end;
$$;
