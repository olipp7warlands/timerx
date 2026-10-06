-- CENSO de objetos de la BD (solo lectura). Se ejecuta envuelto en una migración temporal que ABORTA con RAISE (nunca deja nada):
-- scripts/reset-estreno.mjs (fase `bd`) lo copia a supabase/migrations/NNN_censo_tmp.sql, hace `db push`, lee el mensaje y borra el archivo.
-- El mensaje son líneas `clave=valor` que el guion compara con el censo esperado de v2.0 (docs/runbook-produccion.md §14).
do $$
declare r text := '';
begin
  r := r || format('tablas=%s%s', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'), E'\n');
  r := r || format('vistas=%s%s', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'), E'\n');
  r := r || format('secuencias=%s%s', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'S'), E'\n');
  r := r || format('funciones=%s%s', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'), E'\n');
  r := r || format('funciones_de_trigger=%s%s', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and p.prorettype = 'trigger'::regtype), E'\n');
  r := r || format('triggers=%s%s', (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal), E'\n');
  r := r || format('policies=%s%s', (select count(*) from pg_policies where schemaname = 'public'), E'\n');
  r := r || format('indices=%s%s', (select count(*) from pg_indexes where schemaname = 'public'), E'\n');
  r := r || format('pk=%s%s', (select count(*) from pg_constraint k join pg_namespace n on n.oid = k.connamespace where n.nspname = 'public' and k.contype = 'p'), E'\n');
  r := r || format('fk=%s%s', (select count(*) from pg_constraint k join pg_namespace n on n.oid = k.connamespace where n.nspname = 'public' and k.contype = 'f'), E'\n');
  r := r || format('check=%s%s', (select count(*) from pg_constraint k join pg_namespace n on n.oid = k.connamespace where n.nspname = 'public' and k.contype = 'c'), E'\n');
  r := r || format('unique=%s%s', (select count(*) from pg_constraint k join pg_namespace n on n.oid = k.connamespace where n.nspname = 'public' and k.contype = 'u'), E'\n');
  r := r || format('enums=%s%s', (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'), E'\n');
  r := r || format('rls_activa=%s%s', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity), E'\n');
  r := r || format('pre_request=%s%s',
    (select coalesce((select split_part(s, '=', 2) from pg_db_role_setting d join pg_roles ro on ro.oid = d.setrole, unnest(d.setconfig) s where ro.rolname = 'authenticator' and s like 'pgrst.db_pre_request=%' limit 1), 'NO FIJADO')), E'\n');
  -- Normas K/L (023/024): anon no puede ejecutar nada (salvo el pre-request) ni tocar ninguna relación
  r := r || format('anon_con_execute=%s%s',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname <> 'cuenta_desactivada_pre_request' and has_function_privilege('anon', p.oid, 'execute')), E'\n');
  r := r || format('anon_con_privilegios_de_relacion=%s%s',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
       and ((c.relkind in ('r', 'v', 'm', 'p', 'f') and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')) or (c.relkind = 'S' and has_sequence_privilege('anon', c.oid, 'usage, select, update')))), E'\n');
  -- Modelo v2.0 (030/031)
  r := r || format('v20_tablas_nuevas_con_rls=%s%s',
    (select count(*) from pg_class c where c.relname in ('empresa_departamento', 'perfil_departamento', 'respaldo_v20') and c.relrowsecurity), E'\n');
  r := r || format('v20_anon_en_tablas_nuevas=%s%s',
    (select count(*) from pg_class c where c.relname in ('empresa_departamento', 'perfil_departamento', 'respaldo_v20') and has_table_privilege('anon', c.oid, 'select, insert, update, delete')), E'\n');
  r := r || format('v20_authenticated_lee_respaldo=%s%s', has_table_privilege('authenticated', 'public.respaldo_v20', 'select'), E'\n');
  r := r || format('v20_espejo_ejecutable_por_anon_o_authenticated=%s%s',
    has_function_privilege('anon', 'departamento_espejo()', 'execute') or has_function_privilege('authenticated', 'departamento_espejo()', 'execute'), E'\n');
  r := r || format('v20_trigger_espejo=%s%s', exists (select 1 from pg_trigger where tgname = 'departamento_espejo' and not tgisinternal), E'\n');
  r := r || format('v20_categoria_departamento_not_null_unique=%s%s',
    (select a.attnotnull from pg_attribute a where a.attrelid = 'public.categoria'::regclass and a.attname = 'departamento_id') and exists (select 1 from pg_constraint where conname = 'categoria_departamento_unico'), E'\n');
  r := r || format('v20_departamento_color_check=%s%s', exists (select 1 from pg_constraint where conname = 'departamento_color_check'), E'\n');
  raise exception E'CENSO:\n%', r;
end $$;
