-- =============================================================================
-- supabase/seed.sql — Catálogo de desarrollo (sin dependencia de auth.users)
-- Nombres literales extraídos de mocks/panel_administracion.html y
-- mocks/app_movil_empleado.html (regla del proyecto: los mocks no se reinterpretan).
-- UUIDs fijos para poder referenciarlos desde scripts/seed-usuarios.mjs y
-- supabase/seed_datos.sql. Ejecutar DESPUÉS de las migraciones 001-003.
-- =============================================================================

-- 1. Empresas ------------------------------------------------------------------
insert into empresa (id, nombre, cif) values
  ('00000000-0000-0000-0000-000000000001', 'Wowinx SL',      'B-11223344'),
  ('00000000-0000-0000-0000-000000000002', 'Málaga CF SAD',  'A-99887766'),
  ('00000000-0000-0000-0000-000000000003', 'Legal Norte SL', 'B-55667788');

-- 2. Categorías (panel_administracion.html, sección Categorías > Catálogo) -----
insert into categoria (id, nombre) values
  ('00000000-0000-0000-0001-000000000001', 'Desarrollo'),
  ('00000000-0000-0000-0001-000000000002', 'Diseño'),
  ('00000000-0000-0000-0001-000000000003', 'Abogados'),
  ('00000000-0000-0000-0001-000000000004', 'Gestión');

-- 3. Subcategorías ---------------------------------------------------------------
insert into subcategoria (id, categoria_id, nombre) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'Backend'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', 'Frontend'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', 'QA'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001', 'Soporte'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000002', 'Maquetación'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000002', 'Branding'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000002', 'UX'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000003', 'Contratos'),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000003', 'Bajas laborales'),
  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-000000000003', 'Mercantil'),
  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-000000000003', 'Litigios'),
  ('00000000-0000-0000-0002-00000000000c', '00000000-0000-0000-0001-000000000004', 'Reuniones'),
  ('00000000-0000-0000-0002-00000000000d', '00000000-0000-0000-0001-000000000004', 'Administración'),
  ('00000000-0000-0000-0002-00000000000e', '00000000-0000-0000-0001-000000000004', 'RRHH');

-- 4. Proyectos (tabla "Proyectos" del panel, 7 filas) ---------------------------
-- "Interno" está marcado en el mock como "no refacturable"; el esquema actual
-- (001/002) no tiene columna refacturable en proyecto — la refacturación se
-- deriva solo de empresa_origen<>empresa_destino (v_refacturacion_mensual).
-- No se modifica el esquema para esto (fuera del alcance del bug corregido en 003).
insert into proyecto (id, empresa_id, codigo, nombre) values
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001', 'XIM',      'Ximeras'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000002', 'WEBCORP',  'Web corporativa'),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000003', 'ASESINT',  'Asesoría intragrupo'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000001', 'TRX',      'Triatix'),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000001', 'INTERNO',  'Interno'),
  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000002', 'MCHEF',    'Masterchef'),
  ('00000000-0000-0000-0003-000000000007', '00000000-0000-0000-0000-000000000001', 'LAUNCHER', 'Launcher');

-- 5. Departamentos (responsable_id se completa en seed_datos.sql, tras crear perfiles) --
insert into departamento (id, nombre) values
  ('00000000-0000-0000-0004-000000000001', '3B3'),
  ('00000000-0000-0000-0004-000000000002', 'Jurídico'),
  ('00000000-0000-0000-0004-000000000003', 'Diseño');

-- ajuste y festivo ya vienen sembrados por la propia migración 002.
