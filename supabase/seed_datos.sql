-- =============================================================================
-- supabase/seed_datos.sql — Datos dependientes de auth.users
-- Ejecutar DESPUÉS de: 001-003 (migraciones) -> supabase/seed.sql (catálogo) ->
-- scripts/seed-usuarios.mjs (crea auth.users + perfil vía handle_new_user()).
-- Usa los mismos UUIDs fijos definidos en scripts/seed-usuarios.mjs y
-- supabase/seed.sql.
-- =============================================================================

-- 1. Completar perfil (categoría por defecto y departamento) -------------------
update perfil set categoria_id = '00000000-0000-0000-0001-000000000001', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000001'; -- Cristian Haro / Desarrollo / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000001', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000002'; -- Verónica Salguero / Desarrollo / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000001', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000003'; -- Andrés Fuentes / Desarrollo / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000001', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000004'; -- Leo Silva / Desarrollo / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000002', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000005'; -- Sara Martín / Diseño / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000003', departamento_id = '00000000-0000-0000-0004-000000000002' where id = '10000000-0000-0000-0000-000000000006'; -- Ana Ruiz / Abogados / Jurídico
update perfil set categoria_id = '00000000-0000-0000-0001-000000000001', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000007'; -- Cosme Hernandez / Desarrollo / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000001', departamento_id = '00000000-0000-0000-0004-000000000001' where id = '10000000-0000-0000-0000-000000000008'; -- Daniel Ramírez / Desarrollo / 3B3
update perfil set categoria_id = '00000000-0000-0000-0001-000000000003', departamento_id = '00000000-0000-0000-0004-000000000002' where id = '10000000-0000-0000-0000-000000000009'; -- Marta Gil / Abogados / Jurídico
-- Enrique Robles (admin_empresa, Málaga CF): sin categoría/departamento de grupo.

-- 2. Responsable de departamento -------------------------------------------------
update departamento set responsable_id = '10000000-0000-0000-0000-000000000001' where nombre = '3B3'; -- Cristian Haro

-- 3. Tarifas (PLAN.md sección 6 + tabla "Detalle por empresa y categoría" del mock) --
insert into tarifa (categoria_id, empresa_origen_id, coste_hora, vigente_desde) values
  ('00000000-0000-0000-0001-000000000001', null, 60.00, '2026-01-01'), -- Desarrollo
  ('00000000-0000-0000-0001-000000000002', null, 55.00, '2026-01-01'), -- Diseño
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000003', 95.00, '2026-01-01'), -- Abogados (origen Legal Norte)
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000003', 57.50, '2026-01-01'); -- Gestión (origen Legal Norte)
insert into tarifa (empleado_id, coste_hora, vigente_desde) values
  ('10000000-0000-0000-0000-000000000006', 110.00, '2026-01-01'); -- Ana Ruiz: prioridad sobre su categoría

-- 4. Asignaciones empleado -> proyecto (PDET del panel + selector de la app móvil) --
insert into empleado_proyecto (empleado_id, proyecto_id, desde) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000001', '2026-06-01'), -- Cristian / Ximeras
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000002', '2026-06-01'), -- Cristian / Web corporativa
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000004', '2026-06-01'), -- Cristian / Triatix
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000005', '2026-06-01'), -- Cristian / Interno
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000007', '2026-06-01'), -- Cristian / Launcher (sin imputaciones: "sin actividad")
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0003-000000000001', '2026-06-01'), -- Verónica / Ximeras
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0003-000000000003', '2026-06-01'), -- Verónica / Asesoría intragrupo
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0003-000000000004', '2026-06-01'), -- Verónica / Triatix
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0003-000000000005', '2026-06-01'), -- Verónica / Interno
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0003-000000000001', '2026-06-01'), -- Andrés / Ximeras
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0003-000000000002', '2026-06-01'), -- Andrés / Web corporativa
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0003-000000000004', '2026-06-01'), -- Andrés / Triatix
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0003-000000000001', '2026-06-01'), -- Sara / Ximeras
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0003-000000000002', '2026-06-01'), -- Sara / Web corporativa
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0003-000000000005', '2026-06-01'), -- Sara / Interno
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0003-000000000001', '2026-06-01'), -- Ana Ruiz / Ximeras
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0003-000000000003', '2026-06-01'), -- Ana Ruiz / Asesoría intragrupo
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0003-000000000005', '2026-06-01'), -- Ana Ruiz / Interno
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0003-000000000002', '2026-06-01'), -- Leo Silva / Web corporativa
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0003-000000000003', '2026-06-01'); -- Marta Gil / Asesoría intragrupo

-- 5. Ausencias (tabla "Ausencias" del panel + PLAN.md sección 6) ----------------
insert into ausencia (perfil_id, tipo, fecha_inicio, fecha_fin, estado, resuelta_por, resuelta_at) values
  ('10000000-0000-0000-0000-000000000003', 'baja_medica', '2026-09-01', '2026-09-02', 'aprobada', '10000000-0000-0000-0000-000000000001', now()), -- Andrés Fuentes
  ('10000000-0000-0000-0000-000000000010', 'vacaciones',  '2026-09-14', '2026-09-18', 'rechazada', '10000000-0000-0000-0000-000000000001', now()); -- Enrique Robles
insert into ausencia (perfil_id, tipo, fecha_inicio, fecha_fin, estado) values
  ('10000000-0000-0000-0000-000000000004', 'vacaciones', '2026-09-21', '2026-10-09', 'pendiente'), -- Leo Silva
  ('10000000-0000-0000-0000-000000000002', 'vacaciones', '2026-09-21', '2026-09-25', 'pendiente'); -- Verónica Salguero

-- 6. Imputaciones ----------------------------------------------------------------
-- Septiembre: reproduce las horas exactas de PDET (ficha de proyecto del panel),
-- repartidas en tramos de hasta 12h/día (tope diario) en días laborables
-- consecutivos por empleado, evitando el 1-2/09 de Andrés (baja aprobada).
-- Julio y agosto: los mocks solo dan agregados de GRUPO para esos meses (no hay
-- desglose por empleado/proyecto como en septiembre), así que se siembra una
-- línea ilustrativa de 6h por pareja empleado-proyecto para poblar el histórico
-- y poder cerrar esos periodos -- no son una reproducción exacta de los KPIs
-- mensuales del mock (1771,0h julio / 1612,0h agosto en total de grupo).
create temporary table _seed_cursor (empleado_id uuid primary key, proxima date);

do $$
declare
  asignaciones jsonb := '[
    {"e":"10000000-0000-0000-0000-000000000001","p":"00000000-0000-0000-0003-000000000001","s":"00000000-0000-0000-0002-000000000001","h":96.0},
    {"e":"10000000-0000-0000-0000-000000000002","p":"00000000-0000-0000-0003-000000000001","s":"00000000-0000-0000-0002-000000000001","h":88.0},
    {"e":"10000000-0000-0000-0000-000000000003","p":"00000000-0000-0000-0003-000000000001","s":"00000000-0000-0000-0002-000000000001","h":68.0},
    {"e":"10000000-0000-0000-0000-000000000005","p":"00000000-0000-0000-0003-000000000001","s":"00000000-0000-0000-0002-000000000005","h":42.0},
    {"e":"10000000-0000-0000-0000-000000000006","p":"00000000-0000-0000-0003-000000000001","s":"00000000-0000-0000-0002-000000000008","h":24.0},
    {"e":"10000000-0000-0000-0000-000000000005","p":"00000000-0000-0000-0003-000000000002","s":"00000000-0000-0000-0002-000000000005","h":92.0},
    {"e":"10000000-0000-0000-0000-000000000003","p":"00000000-0000-0000-0003-000000000002","s":"00000000-0000-0000-0002-000000000001","h":64.0},
    {"e":"10000000-0000-0000-0000-000000000001","p":"00000000-0000-0000-0003-000000000002","s":"00000000-0000-0000-0002-000000000001","h":60.0},
    {"e":"10000000-0000-0000-0000-000000000004","p":"00000000-0000-0000-0003-000000000002","s":"00000000-0000-0000-0002-000000000001","h":56.0},
    {"e":"10000000-0000-0000-0000-000000000006","p":"00000000-0000-0000-0003-000000000003","s":"00000000-0000-0000-0002-000000000008","h":85.5},
    {"e":"10000000-0000-0000-0000-000000000009","p":"00000000-0000-0000-0003-000000000003","s":"00000000-0000-0000-0002-000000000008","h":72.5},
    {"e":"10000000-0000-0000-0000-000000000002","p":"00000000-0000-0000-0003-000000000003","s":"00000000-0000-0000-0002-000000000001","h":24.0},
    {"e":"10000000-0000-0000-0000-000000000001","p":"00000000-0000-0000-0003-000000000004","s":"00000000-0000-0000-0002-000000000001","h":70.5},
    {"e":"10000000-0000-0000-0000-000000000002","p":"00000000-0000-0000-0003-000000000004","s":"00000000-0000-0000-0002-000000000001","h":50.0},
    {"e":"10000000-0000-0000-0000-000000000003","p":"00000000-0000-0000-0003-000000000004","s":"00000000-0000-0000-0002-000000000001","h":40.0},
    {"e":"10000000-0000-0000-0000-000000000001","p":"00000000-0000-0000-0003-000000000005","s":"00000000-0000-0000-0002-00000000000c","h":22.0},
    {"e":"10000000-0000-0000-0000-000000000005","p":"00000000-0000-0000-0003-000000000005","s":"00000000-0000-0000-0002-00000000000c","h":20.0},
    {"e":"10000000-0000-0000-0000-000000000006","p":"00000000-0000-0000-0003-000000000005","s":"00000000-0000-0000-0002-00000000000c","h":18.0},
    {"e":"10000000-0000-0000-0000-000000000002","p":"00000000-0000-0000-0003-000000000005","s":"00000000-0000-0000-0002-000000000001","h":16.0}
  ]'::jsonb;
  cristian_admin uuid := '10000000-0000-0000-0000-000000000001';
  andres uuid := '10000000-0000-0000-0000-000000000003';
  meses record;
  a jsonb;
  restante numeric;
  chunk numeric;
  cur date;
  guardas int;
begin
  -- 6a. Julio y agosto: una línea ilustrativa de 6h por asignación.
  for meses in select * from (values ('2026-07-01'::date, '2026-07-31'::date), ('2026-08-01'::date, '2026-08-31'::date)) as t(d1, d2)
  loop
    truncate _seed_cursor;
    for a in select * from jsonb_array_elements(asignaciones)
    loop
      insert into _seed_cursor(empleado_id, proxima) values ((a->>'e')::uuid, meses.d1) on conflict (empleado_id) do nothing;
      select proxima into cur from _seed_cursor where empleado_id = (a->>'e')::uuid;
      while extract(isodow from cur) > 5 loop
        cur := cur + 1;
      end loop;

      insert into imputacion (empleado_id, proyecto_id, subcategoria_id, fecha, horas, estado, aprobado_por, aprobado_en)
      values ((a->>'e')::uuid, (a->>'p')::uuid, (a->>'s')::uuid, cur, 6.0, 'cerrada', cristian_admin, now());

      update _seed_cursor set proxima = cur + 1 where empleado_id = (a->>'e')::uuid;
    end loop;
  end loop;

  -- 6b. Septiembre: horas completas de PDET, en tramos de hasta 12h/día.
  truncate _seed_cursor;
  for a in select * from jsonb_array_elements(asignaciones)
  loop
    insert into _seed_cursor(empleado_id, proxima) values ((a->>'e')::uuid, '2026-09-01') on conflict (empleado_id) do nothing;
    restante := (a->>'h')::numeric;

    while restante > 0 loop
      select proxima into cur from _seed_cursor where empleado_id = (a->>'e')::uuid;
      guardas := 0;
      while (extract(isodow from cur) > 5 or (cur in ('2026-09-01','2026-09-02') and (a->>'e')::uuid = andres)) and guardas < 45 loop
        cur := cur + 1;
        guardas := guardas + 1;
      end loop;

      chunk := least(restante, 12);
      insert into imputacion (empleado_id, proyecto_id, subcategoria_id, fecha, horas, estado, aprobado_por, aprobado_en)
      values ((a->>'e')::uuid, (a->>'p')::uuid, (a->>'s')::uuid, cur, chunk, 'aprobada', cristian_admin, now());

      restante := restante - chunk;
      update _seed_cursor set proxima = cur + 1 where empleado_id = (a->>'e')::uuid;
    end loop;
  end loop;
end $$;

drop table _seed_cursor;

-- 7. Cierre de periodos julio y agosto (después de insertar las imputaciones:
--    el trigger imputacion_validar bloquea altas sobre periodos ya cerrados).
insert into periodo (empresa_id, anio, mes, estado, cerrado_por, cerrado_en)
select e.id, m.anio, m.mes, 'cerrado', '10000000-0000-0000-0000-000000000001', now()
from empresa e
cross join (values (2026, 7), (2026, 8)) as m(anio, mes);

-- 8. F5: líneas en 'enviada' para que la bandeja de aprobación se enseñe
--    poblada desde el primer vistazo. Adicionales a las horas de PDET del
--    punto 6 (no las tocan) -- días/personas elegidos con hueco real bajo
--    el tope de 12h/día verificado contra la base, evitando a Andrés y el
--    proyecto Ximeras para no rozar los cuadres ya reconciliados de F4
--    (fte_mes() igualmente ignora 'enviada' por completo, así que esto no
--    podría moverlos aunque quisiera -- precaución adicional, no necesidad).
--    Leo Silva / Web corporativa -> destino Málaga CF SAD (prueba el ámbito
--    "aprueba la empresa destino" con Marina). Sara Martín / Interno ->
--    destino Wowinx (queda fuera del ámbito de Marina, dentro del de Cristian).
insert into imputacion (empleado_id, proyecto_id, subcategoria_id, fecha, horas, estado) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0002-000000000001', '2026-09-08', 4.0, 'enviada'), -- Leo Silva / Web corporativa
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0002-000000000001', '2026-09-09', 3.0, 'enviada'), -- Leo Silva / Web corporativa
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0002-00000000000c', '2026-09-04', 3.0, 'enviada'); -- Sara Martín / Interno
