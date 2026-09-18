-- =============================================================================
-- 017: importar_ausencias() -- alta masiva de ausencias como HECHOS
-- CONSUMADOS del plan anual (no solicitudes): nacen `aprobada`, con el admin
-- que importa como `resuelta_por`. Efecto aguas abajo idéntico a aprobar_ausencia()
-- (002): mismos consumidores (dias_ausencia_en_mes, faltantes, fte_mes...) y
-- los borradores del empleado en esos días se eliminan igual.
--
-- Una sola función = una sola transacción: si cualquier fila falla (p. ej. el
-- trigger de solapes trg_ausencia_validar) TODO se revierte -- todo-o-nada
-- garantizado por Postgres, no por compensación. El análisis en seco del
-- importador ya habrá cazado los errores previsibles; esto es la red.
-- Solo admin_grupo (operación estructural masiva).
-- =============================================================================

create or replace function importar_ausencias(p_filas jsonb) returns int
language plpgsql security definer set search_path = public
as $$
declare
  f    jsonb;
  v_id uuid;
  v_n  int := 0;
begin
  if not es_admin_grupo() then
    raise exception 'Solo admin_grupo puede importar ausencias';
  end if;

  for f in select * from jsonb_array_elements(p_filas) loop
    insert into ausencia (perfil_id, tipo, fecha_inicio, fecha_fin, comentario, estado, resuelta_por, resuelta_at)
    values (
      (f ->> 'perfil_id')::uuid,
      (f ->> 'tipo')::tipo_ausencia,
      (f ->> 'fecha_inicio')::date,
      (f ->> 'fecha_fin')::date,
      'Importada (plan anual)',
      'aprobada', auth.uid(), now()
    )
    returning id into v_id;

    -- Igual que aprobar_ausencia(): los borradores de esos días dejan de tener sentido.
    delete from imputacion i
    using ausencia a
    where a.id = v_id
      and i.empleado_id = a.perfil_id
      and i.estado = 'borrador'
      and i.fecha between a.fecha_inicio and a.fecha_fin;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke execute on function importar_ausencias(jsonb) from public, anon;
grant execute on function importar_ausencias(jsonb) to authenticated;
