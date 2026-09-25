-- =============================================================================
-- 029: Jornada por defecto de las empresas NUEVAS = el estándar real del grupo (8/8/8/8/5,5/0/0), y EDITABLE.
--
-- Hallazgo (lote v1.4): el trigger `empresa_jornada_defecto` (019) sembraba cada empresa nueva con
-- `ajuste.jornada_horas` (=8) en L-V y 0 en S-D, es decir 8/8/8/8/8/0/0, no el estándar del grupo (viernes 5,5). Prueba en
-- producción: «Oli FC» (creada por UI tras el seed) nació con viernes = 8; las 3 empresas sembradas tienen 5,5. Efecto:
-- +2,5 h requeridas cada viernes (sept-2026: 176 h en vez de 166 h).
--
-- Solución (sin cablear valores en el trigger): la FUENTE del defecto es un ajuste editable como el resto,
-- `ajuste.jornada_semanal_defecto` = lista de 7 números (lunes..domingo), que lee la función `jornada_defecto(dia)`. Ese
-- valor se edita desde Ajustes (solo admin_grupo, RLS `ajuste_admin`) y un trigger de validación impide guardar algo que no
-- sean 7 números entre 0 y 24. Afecta solo a empresas FUTURAS: la jornada de las ya creadas se edita en Calendario.
--
-- `ajuste.jornada_horas` / `jornada_horas()` (plana, de la 002) QUEDA OBSOLETO. Usos que había y qué se hace con cada uno
-- (medido en el catálogo vivo: 3 funciones la mencionaban):
--   * trg_empresa_jornada_defecto()  (019)  siembra de empresas nuevas      -> RETIRADO: ahora lee jornada_defecto()
--   * jornada_del_dia()              (019)  respaldo si la empresa no tiene fila del día -> RETIRADO: idem
--   * resumen_dia()                  (021)  clave `jornada` del JSON          -> se MANTIENE (la app no la lee; quitarla
--                                            cambiaría la forma del JSON y la huella de regresión sin ningún beneficio)
--   * `jornada_defecto()` la usa como último respaldo si el ajuste nuevo faltara o estuviera mal formado.
--   * En la app: `useAjustes.jornadaHoras` (leído, nunca pintado) -> RETIRADO en este lote.
--   * seeds (`seed.sql`, `seed-produccion.sql`): siguen fijando `jornada_horas = 8` (inocuo) y las jornadas por empresa.
--
-- Backfill (misma migración):
--   1. Cualquier empresa a la que le falten días de `empresa_jornada` recibe los que faltan con el defecto (hoy: ninguna).
--   2. «Oli FC» (empresa de prueba del propietario en producción): su viernes pasa de 8 a 5,5 SOLO si su jornada sigue siendo
--      exactamente el defecto antiguo 8/8/8/8/8/0/0 (nadie la ha tocado). No-op si no existe (la demo) o ya está editada. La
--      migración NO borra la empresa: puede tener datos colgando (decide el propietario).
--   Las 3 empresas del seed no se tocan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El ajuste nuevo (lunes..domingo, ISO) y su validación
-- -----------------------------------------------------------------------------
insert into ajuste (clave, valor) values ('jornada_semanal_defecto', '[8, 8, 8, 8, 5.5, 0, 0]'::jsonb)
on conflict (clave) do nothing;

create or replace function trg_ajuste_validar() returns trigger
language plpgsql
as $$
begin
  if new.clave = 'jornada_semanal_defecto' then
    if jsonb_typeof(new.valor) is distinct from 'array'
       or jsonb_array_length(new.valor) <> 7
       or exists (
         select 1 from jsonb_array_elements(new.valor) e
         where case when jsonb_typeof(e) = 'number' then not ((e #>> '{}')::numeric between 0 and 24) else true end
       ) then
      raise exception 'jornada_semanal_defecto debe ser una lista de 7 números entre 0 y 24 (lunes a domingo)' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ajuste_validar on ajuste;
create trigger ajuste_validar before insert or update on ajuste
  for each row execute function trg_ajuste_validar();

revoke execute on function trg_ajuste_validar() from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Horas del día ISO (1 lunes ... 7 domingo) de la jornada por defecto
-- -----------------------------------------------------------------------------
create or replace function jornada_defecto(p_dia int) returns numeric
language sql stable
as $$
  select coalesce(
    (select ((a.valor -> (p_dia - 1)) #>> '{}')::numeric
       from ajuste a
      where a.clave = 'jornada_semanal_defecto' and jsonb_typeof(a.valor) = 'array' and jsonb_array_length(a.valor) = 7),
    -- Último respaldo (ajuste borrado o mal formado): la jornada plana heredada en L-V, 0 en S-D.
    case when p_dia <= 5 then jornada_horas() else 0 end
  )
$$;

revoke all on function jornada_defecto(int) from public, anon;
grant execute on function jornada_defecto(int) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Los dos usos activos de jornada_horas() pasan a la fuente nueva (cuerpos idénticos salvo el defecto)
-- -----------------------------------------------------------------------------
create or replace function trg_empresa_jornada_defecto() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into empresa_jornada (empresa_id, dia_semana, horas)
  select new.id, d.n, jornada_defecto(d.n)
  from generate_series(1, 7) as d(n)
  on conflict (empresa_id, dia_semana) do nothing;
  return new;
end;
$$;

create or replace function jornada_del_dia(p_empresa uuid, p_fecha date) returns numeric
language sql stable
as $$
  select coalesce(
    (select ej.horas from empresa_jornada ej
      where ej.empresa_id = p_empresa and ej.dia_semana = extract(isodow from p_fecha)::int),
    jornada_defecto(extract(isodow from p_fecha)::int)
  )
$$;

comment on function jornada_horas() is
  'OBSOLETA desde la 029: jornada plana heredada (ajuste.jornada_horas). Solo la usa la clave `jornada` del JSON de resumen_dia() (que la app no lee) y, como último respaldo, jornada_defecto(). El defecto de las empresas nuevas es ajuste.jornada_semanal_defecto.';

-- -----------------------------------------------------------------------------
-- 4. Backfill
-- -----------------------------------------------------------------------------
insert into empresa_jornada (empresa_id, dia_semana, horas)
select e.id, d.n, jornada_defecto(d.n)
from empresa e cross join generate_series(1, 7) as d(n)
on conflict (empresa_id, dia_semana) do nothing;

update empresa_jornada ej
   set horas = 5.5
 where ej.dia_semana = 5
   and ej.horas = 8
   and ej.empresa_id in (
     select e.id from empresa e
      where e.nombre = 'Oli FC'
        and (select array_agg(j.horas order by j.dia_semana) from empresa_jornada j where j.empresa_id = e.id) = array[8, 8, 8, 8, 8, 0, 0]::numeric[]
   );

-- -----------------------------------------------------------------------------
-- 5. AUTOCOMPROBACIÓN
-- -----------------------------------------------------------------------------
do $$
declare
  v numeric[];
begin
  select array_agg(jornada_defecto(d.n) order by d.n) into v from generate_series(1, 7) d(n);
  if v is distinct from array[8, 8, 8, 8, 5.5, 0, 0]::numeric[] then
    raise exception '029: jornada_defecto no da 8/8/8/8/5,5/0/0 (da %)', v;
  end if;
  -- respaldo de jornada_del_dia para una empresa sin filas: lunes 8, viernes 5,5, sábado 0
  if jornada_del_dia(gen_random_uuid(), date '2026-09-21') <> 8 or jornada_del_dia(gen_random_uuid(), date '2026-09-25') <> 5.5 or jornada_del_dia(gen_random_uuid(), date '2026-09-26') <> 0 then
    raise exception '029: jornada_del_dia no usa el defecto nuevo';
  end if;
  if exists (select 1 from empresa e where (select count(*) from empresa_jornada j where j.empresa_id = e.id) <> 7) then
    raise exception '029: hay empresas sin las 7 filas de jornada';
  end if;
  if has_function_privilege('anon', 'jornada_defecto(int)', 'execute') or has_function_privilege('anon', 'trg_ajuste_validar()', 'execute')
     or has_function_privilege('authenticated', 'trg_ajuste_validar()', 'execute') then
    raise exception '029: privilegios de función incorrectos';
  end if;
  if not has_function_privilege('authenticated', 'jornada_defecto(int)', 'execute') then
    raise exception '029: authenticated debe poder ejecutar jornada_defecto';
  end if;
end $$;
