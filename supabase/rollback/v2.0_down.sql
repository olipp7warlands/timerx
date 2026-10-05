-- =============================================================================
-- REVERSA de la 031 (v2.0). NO es una migración (no vive en supabase/migrations: no se aplica sola nunca).
-- Se ejecuta a mano envuelta en una migración temporal (como las sondas) o por el SQL editor, SOLO si la 031 sale mal EN PRODUCCIÓN
-- y la reversa es preferible a corregir hacia delante. La 030 (aditiva) se deja puesta: es inocua.
--
-- Restaura desde `respaldo_v20` (creada por la 031): nombres y colores de departamentos, nombre y departamento de las categorías,
-- departamento de los perfiles normalizados; elimina los departamentos que creó la 031 (tras desenlazar a su gente), vacía
-- empresa_departamento y perfil_departamento, quita el invariante UNIQUE/NOT NULL del espejo y borra el respaldo (permite re-ensayar).
-- No toca imputacion, subcategoria ni tarifa. Departamentos creados DESPUÉS de la 031 desde la app se conservan (con su espejo).
-- Autocomprobación final: si algo no cuadra, se revierte.
-- =============================================================================
do $$
declare
  v_n int;
begin
  if not exists (select 1 from respaldo_v20) then
    raise exception 'reversa 031: no existe respaldo_v20 (¿la 031 no se aplicó?)';
  end if;

  -- 1. Perfiles normalizados: vuelven a su departamento anterior.
  update perfil p set departamento_id = nullif(r.valor, '')::uuid
    from respaldo_v20 r where r.tipo = 'perfil' and r.campo = 'departamento_id' and r.id = p.id;

  -- 2. Departamentos con los que nació 031: se desenlaza a su gente y a su categoría ANTES de borrarlos.
  update perfil set departamento_id = null where departamento_id in (select id from respaldo_v20 where tipo = 'departamento_creado');
  delete from empresa_departamento;
  delete from perfil_departamento;

  -- 3. Invariante del espejo fuera.
  alter table categoria drop constraint categoria_departamento_unico;
  alter table categoria alter column departamento_id drop not null;

  -- 4. Nombres y colores de los departamentos que existían (el trigger de la 030 sincroniza el espejo: se sobreescribe en el paso 5).
  update departamento d set nombre = r.valor from respaldo_v20 r where r.tipo = 'departamento' and r.campo = 'nombre' and r.id = d.id;
  update departamento d set color = null where d.id in (select id from respaldo_v20 where tipo = 'departamento' and campo = 'color');

  -- 5. Categorías: nombre y departamento originales (Gestión/Operaciones vuelven a ser globales).
  update categoria c set nombre = r.valor from respaldo_v20 r where r.tipo = 'categoria' and r.campo = 'nombre' and r.id = c.id;
  update categoria c set departamento_id = nullif(r.valor, '')::uuid from respaldo_v20 r where r.tipo = 'categoria' and r.campo = 'departamento_id' and r.id = c.id;

  -- 6. Departamentos creados por la 031.
  delete from departamento where id in (select id from respaldo_v20 where tipo = 'departamento_creado');

  -- 7. Respaldo fuera (permite volver a ensayar 031).
  drop table respaldo_v20;

  -- AUTOCOMPROBACIÓN
  select count(*) into v_n from categoria where nombre = 'Gestión' and departamento_id is null;
  if v_n <> 1 then raise exception 'reversa 031: Gestión no ha vuelto a ser global'; end if;
  if exists (select 1 from departamento where nombre in ('Administración y Finanzas', 'Legal', 'Desarrollo')) then
    raise exception 'reversa 031: quedan nombres de la 031';
  end if;
  if not exists (select 1 from departamento where nombre = '3B3') or not exists (select 1 from departamento where nombre = 'Jurídico') then
    raise exception 'reversa 031: no se restauraron 3B3 / Jurídico';
  end if;
  if exists (select 1 from departamento where color is not null and nombre in ('3B3', 'Diseño', 'Jurídico')) then
    raise exception 'reversa 031: quedan colores';
  end if;
end;
$$;
