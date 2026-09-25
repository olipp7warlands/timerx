-- =============================================================================
-- 027: Soporte -- notificaciones para quien abre el ticket (punto de «novedad»).
--
-- Hasta ahora el empleado no se enteraba de que soporte le había respondido salvo entrando a mirar. Esta migración
-- guarda POR PERFIL hasta cuándo ha visto cada ticket (`ticket_lectura`) y expone qué tickets PROPIOS tienen algo
-- posterior de otra persona.
--
-- Novedad (de un ticket que creó la persona actual) =
--   * un comentario de OTRA persona posterior a su `ultimo_visto`, o
--   * un cambio de ESTADO hecho por otra persona posterior a su `ultimo_visto`.
-- Sin fila de lectura = «nunca lo ha visto»: todo lo de otras personas cuenta como novedad.
-- Cambio de estado: el ticket no guardaba cuándo ni quién lo cambió; es barato de registrar (una columna de fecha, una de
-- autor y un trigger BEFORE UPDATE OF estado) y evita depender solo de los comentarios. Los tickets anteriores a esta
-- migración quedan con `estado_cambiado_en` NULL (sin historia): para ellos solo cuentan los comentarios.
--
-- La tabla es GENÉRICA por perfil (no «solo el creador»): el lado admin podrá reutilizarla para sus propios avisos
-- (mejora futura anotada en PLAN.md); en este lote el lado admin no cambia.
--
-- Decisiones de seguridad (normas 023/024):
--   * RLS: cada perfil lee y escribe SOLO sus filas; no hay DELETE (ni policy ni privilegio).
--   * La marca de «visto» se escribe por RPC con la hora del SERVIDOR (`now()`): la hora del cliente podría ir atrasada
--     respecto a `ticket_comentario.creado_en` y dejar el punto encendido (o apagar uno que no toca).
--   * anon: ningún privilegio de tabla ni EXECUTE; guarda `auth.uid() is null` en la función con efectos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quién y cuándo cambió el estado de un ticket
-- -----------------------------------------------------------------------------
alter table ticket
  add column estado_cambiado_en  timestamptz,
  add column estado_cambiado_por uuid references perfil(id) on delete set null;

create or replace function trg_ticket_estado_cambiado() returns trigger
language plpgsql
as $$
begin
  if new.estado is distinct from old.estado then
    new.estado_cambiado_en  := now();
    new.estado_cambiado_por := auth.uid();   -- null si lo cambia service_role/una migración: cuenta como «otra persona»
  end if;
  return new;
end;
$$;

create trigger ticket_estado_cambiado
  before update of estado on ticket
  for each row execute function trg_ticket_estado_cambiado();

revoke execute on function trg_ticket_estado_cambiado() from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. ticket_lectura: hasta cuándo ha visto cada perfil cada ticket
-- -----------------------------------------------------------------------------
create table ticket_lectura (
  ticket_id    uuid not null references ticket(id) on delete cascade,
  perfil_id    uuid not null references perfil(id) on delete cascade,
  ultimo_visto timestamptz not null default now(),
  primary key (ticket_id, perfil_id)
);

alter table ticket_lectura enable row level security;

create policy ticket_lectura_select on ticket_lectura for select to authenticated
  using (perfil_id = auth.uid());

-- Solo se puede marcar como visto un ticket que la persona VE (puede_ver_ticket, security definer: mismo helper que la 018).
create policy ticket_lectura_insert on ticket_lectura for insert to authenticated
  with check (perfil_id = auth.uid() and puede_ver_ticket(ticket_id));

create policy ticket_lectura_update on ticket_lectura for update to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

revoke all on ticket_lectura from public, anon, authenticated;
grant select on ticket_lectura to authenticated;
grant insert (ticket_id, perfil_id, ultimo_visto) on ticket_lectura to authenticated;
grant update (ultimo_visto) on ticket_lectura to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Marcar un ticket como visto (upsert con la hora del servidor). SECURITY INVOKER: la RLS de arriba es la que manda.
-- -----------------------------------------------------------------------------
create or replace function ticket_marcar_visto(p_ticket uuid) returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '42501';
  end if;
  insert into ticket_lectura (ticket_id, perfil_id, ultimo_visto)
  values (p_ticket, auth.uid(), now())
  on conflict (ticket_id, perfil_id) do update set ultimo_visto = now();
end;
$$;

revoke execute on function ticket_marcar_visto(uuid) from public, anon;
grant execute on function ticket_marcar_visto(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Tickets PROPIOS con novedad. SECURITY INVOKER: la RLS de ticket/ticket_comentario/ticket_lectura acota a la sesión.
-- -----------------------------------------------------------------------------
create or replace function tickets_con_novedad() returns table (ticket_id uuid)
language sql stable security invoker set search_path = public
as $$
  select t.id
  from ticket t
  left join ticket_lectura l on l.ticket_id = t.id and l.perfil_id = auth.uid()
  where t.creado_por = auth.uid()
    and (
      exists (
        select 1 from ticket_comentario c
        where c.ticket_id = t.id
          and c.autor_id <> auth.uid()
          and c.creado_en > coalesce(l.ultimo_visto, '-infinity'::timestamptz)
      )
      or (
        t.estado_cambiado_en is not null
        and t.estado_cambiado_por is distinct from auth.uid()
        and t.estado_cambiado_en > coalesce(l.ultimo_visto, '-infinity'::timestamptz)
      )
    );
$$;

revoke execute on function tickets_con_novedad() from public, anon;
grant execute on function tickets_con_novedad() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. AUTOCOMPROBACIÓN: si algo no queda como se ha descrito, la migración entera se revierte
-- -----------------------------------------------------------------------------
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.ticket_lectura'::regclass) then
    raise exception '027: ticket_lectura sin RLS';
  end if;
  if has_table_privilege('anon', 'public.ticket_lectura'::regclass, 'select, insert, update, delete, truncate, references, trigger') then
    raise exception '027: anon tiene privilegios sobre ticket_lectura';
  end if;
  if has_table_privilege('authenticated', 'public.ticket_lectura'::regclass, 'delete, truncate, references, trigger, insert, update') then
    raise exception '027: authenticated tiene privilegios de tabla de más sobre ticket_lectura (solo SELECT + columnas)';
  end if;
  if not (has_column_privilege('authenticated', 'public.ticket_lectura'::regclass, 'ultimo_visto', 'update')
          and has_column_privilege('authenticated', 'public.ticket_lectura'::regclass, 'ultimo_visto', 'insert')
          and not has_column_privilege('authenticated', 'public.ticket_lectura'::regclass, 'perfil_id', 'update')) then
    raise exception '027: privilegios por columna de ticket_lectura incorrectos';
  end if;
  if has_function_privilege('anon', 'ticket_marcar_visto(uuid)', 'execute') or has_function_privilege('anon', 'tickets_con_novedad()', 'execute') then
    raise exception '027: anon puede ejecutar las RPC de novedad';
  end if;
  if not (has_function_privilege('authenticated', 'ticket_marcar_visto(uuid)', 'execute')
          and has_function_privilege('authenticated', 'tickets_con_novedad()', 'execute')) then
    raise exception '027: authenticated no puede ejecutar las RPC de novedad';
  end if;
  if has_function_privilege('anon', 'trg_ticket_estado_cambiado()', 'execute') or has_function_privilege('authenticated', 'trg_ticket_estado_cambiado()', 'execute') then
    raise exception '027: la función del trigger no debe ser ejecutable directamente';
  end if;
  -- el cliente sigue sin poder fijar el estado_cambiado_* a mano (solo lo escribe el trigger)
  if has_column_privilege('authenticated', 'public.ticket'::regclass, 'estado_cambiado_en', 'update')
     or has_column_privilege('authenticated', 'public.ticket'::regclass, 'estado_cambiado_por', 'update')
     or has_column_privilege('authenticated', 'public.ticket'::regclass, 'estado_cambiado_en', 'insert') then
    raise exception '027: authenticated puede escribir estado_cambiado_*';
  end if;
end $$;
