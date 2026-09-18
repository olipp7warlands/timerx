-- =============================================================================
-- 015: Categorías por departamento — el selector de tarea del empleado (web,
-- móvil, precargado) y la imputación directa de admin dejan de mostrar TODAS
-- las categorías del grupo: una categoría puede ser global (departamento_id
-- NULL) o de un departamento concreto. El empleado ve globales + las de su
-- propio departamento; sin departamento asignado, ve todas (comportamiento
-- actual, sin cambios). Filtra solo opciones futuras del selector, no toca
-- datos ni estados de imputaciones ya existentes.
-- =============================================================================

alter table categoria add column departamento_id uuid references departamento(id);

-- Backfill del seed de demo (ids fijos de supabase/seed.sql, sección 2):
-- Desarrollo y Diseño -> 3B3; Abogados -> Jurídico; Gestión queda global (NULL).
update categoria set departamento_id = '00000000-0000-0000-0004-000000000001'
  where id in ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000002'); -- Desarrollo, Diseño

update categoria set departamento_id = '00000000-0000-0000-0004-000000000002'
  where id = '00000000-0000-0000-0001-000000000003'; -- Abogados
