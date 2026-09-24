-- =============================================================================
-- 026: Fix de dato — la categoría "Diseño" apuntaba al departamento "3B3" en vez
-- de al departamento "Diseño" (bug de estreno v1.1, reportado por producción real:
-- Oliver, departamento Diseño, veía en "Interno" las categorías de Gestión
-- —global— pero no las suyas). Origen: el backfill de la 015 asumió "Desarrollo y
-- Diseño -> 3B3" (comentario original) antes de que existiera un departamento
-- llamado literalmente "Diseño" (seed.sql, sección 5) — nunca se enlazó a él. En
-- la demo quedó latente porque ningún perfil de demo tiene departamento_id =
-- Diseño; en producción sí lo tiene y expone el bug.
--
-- Va vía migración (norma L: todo entra por migración, nunca un UPDATE a mano) y
-- viaja a producción con la próxima promoción (runbook §12), no con este db push
-- a la demo.
-- =============================================================================

update categoria
   set departamento_id = '00000000-0000-0000-0004-000000000003' -- departamento "Diseño"
 where id = '00000000-0000-0000-0001-000000000002' -- categoría "Diseño"
   and departamento_id = '00000000-0000-0000-0004-000000000001'; -- solo si seguía mal casada (3B3): idempotente

do $$
begin
  if (select departamento_id from categoria where id = '00000000-0000-0000-0001-000000000002')
     is distinct from '00000000-0000-0000-0004-000000000003'::uuid then
    raise exception '026: la categoria "Diseño" no quedo enlazada al departamento "Diseño"';
  end if;
end $$;
