-- =============================================================================
-- supabase/seed-produccion.sql -- SEED ESTRUCTURAL DE PRODUCCION (proyecto Supabase NUEVO)
--
-- Derivado, seccion a seccion, del catalogo de la DEMO (`supabase/seed.sql`) contrastado con el ESTADO VIVO de la demo (lo que hay en
-- las tablas hoy, que puede diferir del seed: la demo se ha ido editando). Cada seccion lleva su VEREDICTO: INCLUYE / EXCLUYE / YA
-- SEMBRADO POR MIGRACION, con el porque. Produccion nace SIN historia: solo la estructura real del grupo.
--
-- COMO SE APLICA: DESPUES de `supabase db push` de las 24 migraciones y ANTES de crear la primera cuenta (runbook, fase 2). Es un archivo
-- de UNA SOLA VEZ: la seccion 0 aborta si la base ya tiene datos (no se puede ejecutar contra la demo ni re-ejecutar).
-- Los UUID son los mismos que los de la demo (referencias estables entre seed y codigo); no son secretos.
--
-- PENDIENTE DEL USUARIO antes de aplicar (los CIF son datos reales, no se inventan): sustituir los 3 marcadores @@CIF_...@@ de la seccion 2 por
-- el CIF real de cada empresa SIN guiones ni espacios (p. ej. B12345678). La seccion final ABORTA si queda algun marcador o un CIF con formato invalido.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. GUARDAS
-- VEREDICTO: obligatoria. Impide aplicar el seed a una base con datos (p. ej. la demo) o dos veces.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from empresa) or exists (select 1 from perfil) or exists (select 1 from proyecto) then
    raise exception 'seed-produccion: la base YA tiene datos (empresa/perfil/proyecto). Este seed es solo para un proyecto nuevo y vacio.';
  end if;
  if (select count(*) from ajuste) <> 5 or (select count(*) from festivo) <> 8 then
    raise exception 'seed-produccion: ajuste/festivo no tienen lo que siembran las migraciones (5 ajustes, 8 festivos): ¿estan aplicadas las 24 migraciones?';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. AJUSTES  (siembra la migracion 002; aqui se fijan los valores de PRODUCCION)
-- VEREDICTO: INCLUYE (UPDATE). Va ANTES de insertar empresas: el trigger `empresa_jornada_defecto` (019) crea la jornada semanal de cada
--   empresa nueva a partir de `jornada_horas` (la 002 lo siembra en 7; la demo vive en 8).
--   Valores = los decididos en la demo: jornada_horas=8, tope_horas_dia=12, bloquear_meses_cerrados=true,
--   descripcion_obligatoria=false (estado de la demo; DECIDIR para produccion: sin historia previa podria ser true),
--   recordatorio_email=false. MODO_EMAIL=log es una variable de entorno de Railway, no una fila.
-- -----------------------------------------------------------------------------
update ajuste set valor = '8'::jsonb where clave = 'jornada_horas';
update ajuste set valor = '12'::jsonb where clave = 'tope_horas_dia';
update ajuste set valor = 'false'::jsonb where clave = 'descripcion_obligatoria';
update ajuste set valor = 'true'::jsonb where clave = 'bloquear_meses_cerrados';
update ajuste set valor = 'false'::jsonb where clave = 'recordatorio_email';

-- -----------------------------------------------------------------------------
-- 2. EMPRESAS  (3)
-- VEREDICTO: INCLUYE. Nombres = los del grupo. CIF = REAL (marcadores @@CIF_...@@ a sustituir; la demo tiene CIF ficticios que NO se copian).
--   Se crea la jornada semanal de cada una por trigger (ver seccion 9). La tipologia (area del mapa) se asigna en la seccion 8.
-- -----------------------------------------------------------------------------
insert into empresa (id, nombre, cif) values
  ('00000000-0000-0000-0000-000000000001', 'Wowinx SL', '@@CIF_WOWINX@@'),
  ('00000000-0000-0000-0000-000000000002', 'Málaga CF SAD', '@@CIF_MALAGA@@'),
  ('00000000-0000-0000-0000-000000000003', 'Legal Norte SL', '@@CIF_LEGAL_NORTE@@');

-- -----------------------------------------------------------------------------
-- 3. DEPARTAMENTOS  (3)
-- VEREDICTO: INCLUYE. `responsable_id` queda NULL: en la demo apunta a Cristian (una cuenta que en produccion no existe todavia).
-- -----------------------------------------------------------------------------
insert into departamento (id, nombre, activo) values
  ('00000000-0000-0000-0004-000000000001', '3B3', true),
  ('00000000-0000-0000-0004-000000000003', 'Diseño', true),
  ('00000000-0000-0000-0004-000000000002', 'Jurídico', true);

-- -----------------------------------------------------------------------------
-- 4. CATEGORIAS  (4) con su departamento_id (migracion 015)   |   5. SUBCATEGORIAS / TAREAS  (14)
-- VEREDICTO: INCLUYE tal cual estan en la demo (Desarrollo/Diseno -> 3B3, Abogados -> Juridico, Gestion global).
-- -----------------------------------------------------------------------------
insert into categoria (id, nombre, activa, departamento_id) values
  ('00000000-0000-0000-0001-000000000001', 'Desarrollo', true, '00000000-0000-0000-0004-000000000001'),
  ('00000000-0000-0000-0001-000000000002', 'Diseño', true, '00000000-0000-0000-0004-000000000001'),
  ('00000000-0000-0000-0001-000000000003', 'Abogados', true, '00000000-0000-0000-0004-000000000002'),
  ('00000000-0000-0000-0001-000000000004', 'Gestión', true, null);

insert into subcategoria (id, categoria_id, nombre, activa) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'Backend', true),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001', 'Frontend', true),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', 'QA', true),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001', 'Soporte', true),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000002', 'Maquetación', true),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000002', 'Branding', true),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000002', 'UX', true),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000003', 'Contratos', true),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000003', 'Bajas laborales', true),
  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-000000000003', 'Mercantil', true),
  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-000000000003', 'Litigios', true),
  ('00000000-0000-0000-0002-00000000000c', '00000000-0000-0000-0001-000000000004', 'Reuniones', true),
  ('00000000-0000-0000-0002-00000000000d', '00000000-0000-0000-0001-000000000004', 'Administración', true),
  ('00000000-0000-0000-0002-00000000000e', '00000000-0000-0000-0001-000000000004', 'RRHH', true);

-- -----------------------------------------------------------------------------
-- 6. MAPA DEL GRUPO: 6 areas y 22 elementos
-- VEREDICTO: INCLUYE las areas y elementos reales. EXCLUYE 2 areas y 2 elementos de la demo que son restos de
--   pruebas de verificacion (inactivos): Zona de prueba F6, Zona de prueba F6 prod / Elemento prod, Elemento de prueba F6.
-- -----------------------------------------------------------------------------
insert into mapa_area (id, nombre, color, orden, activa) values
  ('00000000-0000-0000-0005-000000000001', 'Infraestructura', '#5E7A8C', 1, true),
  ('00000000-0000-0000-0005-000000000002', 'Tecnología', '#5E8C86', 2, true),
  ('00000000-0000-0000-0005-000000000003', 'Deportes', '#6E8B72', 3, true),
  ('00000000-0000-0000-0005-000000000004', 'Dinero', '#8C7A5E', 4, true),
  ('00000000-0000-0000-0005-000000000005', 'Cultura', '#7C6480', 5, true),
  ('00000000-0000-0000-0005-000000000006', 'Entretenimiento', '#8C5E62', 6, true);

insert into mapa_item (id, area_id, nombre, etiqueta, descripcion, empresa_id, url, orden, activo) values
  ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0005-000000000001', '3B3', 'FS', 'Fábrica de software del grupo: desarrollo, QA y soporte.', '00000000-0000-0000-0000-000000000001', null, 1, true),
  ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0005-000000000001', 'Alethern', 'W3', 'Identidad y credenciales verificables.', '00000000-0000-0000-0000-000000000001', null, 2, true),
  ('00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0005-000000000001', 'WIA', 'IA', 'Asistentes y automatización interna.', '00000000-0000-0000-0000-000000000001', null, 3, true),
  ('00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0005-000000000001', 'prismaXR', 'XR', 'Experiencias inmersivas y realidad extendida.', '00000000-0000-0000-0000-000000000001', null, 4, true),
  ('00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0005-000000000002', 'Ximeras', null, 'Plataforma SaaS principal del grupo.', '00000000-0000-0000-0000-000000000001', null, 1, true),
  ('00000000-0000-0000-0006-000000000006', '00000000-0000-0000-0005-000000000002', 'Triatix', null, 'Suite de herramientas de datos.', '00000000-0000-0000-0000-000000000001', null, 2, true),
  ('00000000-0000-0000-0006-000000000007', '00000000-0000-0000-0005-000000000002', 'Launcher', null, 'Lanzadera interna de nuevos productos.', '00000000-0000-0000-0000-000000000001', null, 3, true),
  ('00000000-0000-0000-0006-000000000008', '00000000-0000-0000-0005-000000000002', 'seetreX', null, 'Monitorización e informes en tiempo real.', '00000000-0000-0000-0000-000000000001', null, 4, true),
  ('00000000-0000-0000-0006-000000000009', '00000000-0000-0000-0005-000000000002', 'Ownia', null, 'Gestión de activos digitales.', '00000000-0000-0000-0000-000000000001', null, 5, true),
  ('00000000-0000-0000-0006-00000000000a', '00000000-0000-0000-0005-000000000003', 'Málaga CF', null, 'El club y su ecosistema digital.', '00000000-0000-0000-0000-000000000002', null, 1, true),
  ('00000000-0000-0000-0006-00000000000b', '00000000-0000-0000-0005-000000000003', 'BeFootball', null, 'Comunidad y contenidos de fútbol.', '00000000-0000-0000-0000-000000000002', null, 2, true),
  ('00000000-0000-0000-0006-00000000000c', '00000000-0000-0000-0005-000000000003', 'BeSports Academy', null, 'Formación deportiva.', '00000000-0000-0000-0000-000000000002', null, 3, true),
  ('00000000-0000-0000-0006-00000000000d', '00000000-0000-0000-0005-000000000004', 'Bullfy', null, 'Educación financiera.', '00000000-0000-0000-0000-000000000001', null, 1, true),
  ('00000000-0000-0000-0006-00000000000e', '00000000-0000-0000-0005-000000000004', 'Easyfi', null, 'Pagos y liquidaciones.', '00000000-0000-0000-0000-000000000001', null, 2, true),
  ('00000000-0000-0000-0006-00000000000f', '00000000-0000-0000-0005-000000000004', 'eSignus', null, 'Firma electrónica y custodia legal.', '00000000-0000-0000-0000-000000000003', null, 3, true),
  ('00000000-0000-0000-0006-000000000010', '00000000-0000-0000-0005-000000000004', 'HashWallet', null, 'Cartera de activos digitales.', '00000000-0000-0000-0000-000000000001', null, 4, true),
  ('00000000-0000-0000-0006-000000000011', '00000000-0000-0000-0005-000000000005', 'ROV', null, 'Producción audiovisual.', '00000000-0000-0000-0000-000000000001', null, 1, true),
  ('00000000-0000-0000-0006-000000000012', '00000000-0000-0000-0005-000000000005', 'Banana Warriors', null, 'Estudio creativo.', '00000000-0000-0000-0000-000000000001', null, 2, true),
  ('00000000-0000-0000-0006-000000000013', '00000000-0000-0000-0005-000000000005', 'The Archives of Silence', null, 'Proyecto editorial.', '00000000-0000-0000-0000-000000000001', null, 3, true),
  ('00000000-0000-0000-0006-000000000014', '00000000-0000-0000-0005-000000000006', 'doubleW', null, 'Juegos y experiencias.', '00000000-0000-0000-0000-000000000001', null, 1, true),
  ('00000000-0000-0000-0006-000000000015', '00000000-0000-0000-0005-000000000006', 'IMM', null, 'Medios interactivos.', '00000000-0000-0000-0000-000000000001', null, 2, true),
  ('00000000-0000-0000-0006-000000000016', '00000000-0000-0000-0005-000000000006', 'AIdols', null, 'Entretenimiento con IA.', '00000000-0000-0000-0000-000000000001', null, 3, true);

-- -----------------------------------------------------------------------------
-- 7. PROYECTOS  (7)  SIN tarifas ni asignaciones
-- VEREDICTO: INCLUYE (con su tipologia = area del mapa, migracion 020: heredan de la empresa salvo Interno y Asesoria intragrupo).
--   Los proyectos son los de la demo: CONFIRMAR con el usuario que son los reales (falta alguno / sobra alguno).
--   EXCLUYE: `empleado_proyecto` (asignaciones), `proyecto_responsable`, `tarifa`.
-- -----------------------------------------------------------------------------
insert into proyecto (id, empresa_id, codigo, nombre, activo, area_id) values
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000003', 'ASESINT', 'Asesoría intragrupo', true, null),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000001', 'INTERNO', 'Interno', true, null),
  ('00000000-0000-0000-0003-000000000007', '00000000-0000-0000-0000-000000000001', 'LAUNCHER', 'Launcher', true, '00000000-0000-0000-0005-000000000002'),
  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000002', 'MCHEF', 'Masterchef', true, '00000000-0000-0000-0005-000000000003'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000001', 'TRX', 'Triatix', true, '00000000-0000-0000-0005-000000000002'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000002', 'WEBCORP', 'Web corporativa', true, '00000000-0000-0000-0005-000000000003'),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001', 'XIM', 'Ximeras', true, '00000000-0000-0000-0005-000000000002');

-- -----------------------------------------------------------------------------
-- 8. TIPOLOGIA DE EMPRESA (area del mapa)
-- VEREDICTO: INCLUYE: Wowinx SL -> Tecnología, Málaga CF SAD -> Deportes, Legal Norte SL -> sin tipologia (NULL).
-- -----------------------------------------------------------------------------
update empresa set area_id = '00000000-0000-0000-0005-000000000002' where id = '00000000-0000-0000-0000-000000000001'; -- Wowinx SL -> Tecnología
update empresa set area_id = '00000000-0000-0000-0005-000000000003' where id = '00000000-0000-0000-0000-000000000002'; -- Málaga CF SAD -> Deportes
-- Legal Norte SL: sin tipologia (area_id NULL), como en la demo

-- -----------------------------------------------------------------------------
-- 9. JORNADA SEMANAL  (3 empresas x 7 dias = 21 filas, creadas por el trigger de la 019 con jornada_horas = 8)
-- VEREDICTO: INCLUYE. Jornada real: lunes a jueves 8 h, VIERNES 5,5 h, sabado y domingo 0 (dia_semana ISO: 1 = lunes ... 7 = domingo).
--   Igual para las tres empresas, salvo que el usuario indique jornadas distintas por empresa (PENDIENTE de confirmar).
-- -----------------------------------------------------------------------------
update empresa_jornada set horas = 5.5 where dia_semana = 5;

-- -----------------------------------------------------------------------------
-- 10. FESTIVOS  (8, Espana 2026, ambito grupo)
-- VEREDICTO: YA SEMBRADO POR LA MIGRACION 002 (identicos a los de la demo): NO se re-insertan; la guarda de la seccion 0 y la comprobacion final
--   verifican que estan. Faltan los de 2027 y los locales (p. ej. de Malaga): tarea del checklist de estreno (Calendario).
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 11. QUE NO SE SIEMBRA (produccion nace sin historia)
-- EXCLUYE: perfil / cuentas (nacen por el bootstrap y luego desde el panel), empleado_proyecto, proyecto_responsable, imputacion, ausencia,
--   periodo (cierres), tarifa, coste_empleado, ticket / ticket_comentario (la 018 solo siembra tickets si existen perfiles de demo: en un
--   proyecto nuevo no inserta ninguno; el primero sera T-001), recordatorio_log. `departamento.responsable_id` queda NULL (seccion 3).
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 12. AUTOCOMPROBACION: si algo no cuadra con lo declarado arriba, se aborta y no queda nada aplicado
-- -----------------------------------------------------------------------------
do $$
declare
  v_falla text;
begin
  select string_agg(t || ' = ' || n || ' (esperado ' || e || ')', '; ') into v_falla
  from (values
    ('empresa', (select count(*) from empresa), 3),
    ('departamento', (select count(*) from departamento), 3),
    ('categoria', (select count(*) from categoria), 4),
    ('subcategoria', (select count(*) from subcategoria), 14),
    ('mapa_area', (select count(*) from mapa_area), 6),
    ('mapa_item', (select count(*) from mapa_item), 22),
    ('proyecto', (select count(*) from proyecto), 7),
    ('empresa_jornada', (select count(*) from empresa_jornada), 21),
    ('festivo', (select count(*) from festivo), 8),
    ('ajuste', (select count(*) from ajuste), 5),
    ('perfil', (select count(*) from perfil), 0),
    ('empleado_proyecto', (select count(*) from empleado_proyecto), 0),
    ('proyecto_responsable', (select count(*) from proyecto_responsable), 0),
    ('imputacion', (select count(*) from imputacion), 0),
    ('ausencia', (select count(*) from ausencia), 0),
    ('periodo', (select count(*) from periodo), 0),
    ('tarifa', (select count(*) from tarifa), 0),
    ('coste_empleado', (select count(*) from coste_empleado), 0),
    ('ticket', (select count(*) from ticket), 0),
    ('ticket_comentario', (select count(*) from ticket_comentario), 0),
    ('recordatorio_log', (select count(*) from recordatorio_log), 0)
  ) as x(t, n, e)
  where n <> e;
  if v_falla is not null then raise exception 'seed-produccion: conteos inesperados: %', v_falla; end if;

  if exists (select 1 from empresa where cif is null or cif !~ '^[A-Z][0-9]{7}[0-9A-J]$') then
    raise exception 'seed-produccion: hay CIF sin sustituir (@@CIF_...@@) o con formato invalido (esperado: letra + 7 digitos + digito/letra, sin guiones)';
  end if;

  if (select count(*) from empresa_jornada where dia_semana = 5 and horas = 5.5) <> 3
     or (select count(*) from empresa_jornada where dia_semana in (1, 2, 3, 4) and horas = 8) <> 12
     or (select count(*) from empresa_jornada where dia_semana in (6, 7) and horas = 0) <> 6 then
    raise exception 'seed-produccion: la jornada semanal no es 8/8/8/8/5,5/0/0 en las tres empresas';
  end if;

  if (select valor from ajuste where clave = 'jornada_horas') <> '8'::jsonb then
    raise exception 'seed-produccion: ajuste.jornada_horas no es 8';
  end if;
end $$;
