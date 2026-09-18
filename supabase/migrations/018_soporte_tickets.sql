-- =============================================================================
-- 018: Soporte -- tickets de incidencia/mejora/consulta que el equipo abre desde su
-- app y los admins responden y clasifican. Histórico de QA: NADIE puede borrar.
--
--   ticket             ref secuencial legible T-001 (generada AQUÍ, no en cliente)
--   ticket_comentario  hilo de conversación
--
-- Visibilidad (helper único `puede_ver_ticket`, security definer -- mismo patrón
-- que 008 para no re-evaluar RLS de `perfil` desde las policies):
--   empleado (y responsable_proyecto)  solo SUS tickets y sus hilos
--   admin_empresa                      tickets cuyo CREADOR es de su empresa
--   admin_grupo                        todos
-- Escritura:
--   crear ticket            cualquiera, solo a su nombre (creado_por = auth.uid())
--   comentar                quien VE el ticket, solo a su nombre
--   cambiar estado          SOLO admins (admin_grupo; admin_empresa en su ámbito)
--   borrar                  nadie (ni policy ni privilegio)
-- Un ticket 'abierto' pasa a 'en_curso' cuando un admin (que no es su autor) responde
-- (trigger: una sola vía, atómica con el comentario).
-- =============================================================================

create type ticket_tipo   as enum ('incidencia', 'mejora', 'consulta');
create type ticket_estado as enum ('abierto', 'en_curso', 'resuelto');

create sequence ticket_ref_seq;

create table ticket (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique default ('T-' || lpad(nextval('ticket_ref_seq')::text, 3, '0')),
  creado_por  uuid not null references perfil(id),
  titulo      text not null check (length(btrim(titulo)) > 0),
  descripcion text not null check (length(btrim(descripcion)) > 0),
  tipo        ticket_tipo not null,
  estado      ticket_estado not null default 'abierto',
  creado_en   timestamptz not null default now()
);

create index idx_ticket_creado_por on ticket(creado_por);
create index idx_ticket_estado     on ticket(estado, creado_en desc);

create table ticket_comentario (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references ticket(id),
  autor_id   uuid not null references perfil(id),
  texto      text not null check (length(btrim(texto)) > 0),
  creado_en  timestamptz not null default now()
);

create index idx_ticket_comentario_ticket on ticket_comentario(ticket_id, creado_en);

-- ¿Puede el usuario actual ver (y por tanto comentar) este ticket?
create or replace function puede_ver_ticket(p_ticket uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from ticket t
    join perfil c on c.id = t.creado_por
    where t.id = p_ticket
      and (
        t.creado_por = auth.uid()
        or es_admin_grupo()
        or (auth_rol() = 'admin_empresa' and c.empresa_id = auth_empresa())
      )
  );
$$;

alter table ticket            enable row level security;
alter table ticket_comentario enable row level security;

create policy ticket_select on ticket for select to authenticated
  using (puede_ver_ticket(id));

create policy ticket_insert on ticket for insert to authenticated
  with check (creado_por = auth.uid());

create policy ticket_update_estado on ticket for update to authenticated
  using (auth_rol() in ('admin_grupo', 'admin_empresa') and puede_ver_ticket(id))
  with check (auth_rol() in ('admin_grupo', 'admin_empresa') and puede_ver_ticket(id));

create policy ticket_comentario_select on ticket_comentario for select to authenticated
  using (puede_ver_ticket(ticket_id));

create policy ticket_comentario_insert on ticket_comentario for insert to authenticated
  with check (autor_id = auth.uid() and puede_ver_ticket(ticket_id));

-- Privilegios por COLUMNA (además de RLS): el cliente no puede fijar ref/estado/fecha al crear, ni tocar
-- nada que no sea `estado` al actualizar, ni borrar. (service_role conserva todo, para mantenimiento.)
revoke all on ticket, ticket_comentario from anon, authenticated;
grant select on ticket, ticket_comentario to authenticated;
grant insert (creado_por, titulo, descripcion, tipo) on ticket to authenticated;
grant update (estado) on ticket to authenticated;
grant insert (ticket_id, autor_id, texto) on ticket_comentario to authenticated;

-- Responder = un ticket abierto pasa a en_curso (solo si responde un admin que no es su autor).
create or replace function trg_ticket_comentario_respuesta() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from perfil p where p.id = new.autor_id and p.rol in ('admin_grupo', 'admin_empresa')) then
    update ticket set estado = 'en_curso'
     where id = new.ticket_id and estado = 'abierto' and creado_por <> new.autor_id;
  end if;
  return new;
end;
$$;

create trigger ticket_comentario_respuesta
  after insert on ticket_comentario
  for each row execute function trg_ticket_comentario_respuesta();

-- Hilo con el NOMBRE del autor. Un empleado solo ve su propio perfil (perfil_select), así que un join directo
-- no le mostraría quién le responde: se sirve por función security definer, acotada por puede_ver_ticket.
create or replace function ticket_hilo(p_ticket uuid)
returns table (id uuid, autor_id uuid, autor_nombre text, autor_es_admin boolean, texto text, creado_en timestamptz)
language sql stable security definer set search_path = public
as $$
  select c.id, c.autor_id, p.nombre, p.rol in ('admin_grupo', 'admin_empresa'), c.texto, c.creado_en
  from ticket_comentario c
  join perfil p on p.id = c.autor_id
  where c.ticket_id = p_ticket and puede_ver_ticket(p_ticket)
  order by c.creado_en, c.id;
$$;

revoke execute on function ticket_hilo(uuid) from public, anon;
grant execute on function ticket_hilo(uuid) to authenticated;

-- =============================================================================
-- SEED DE DEMO: los 4 tickets del mock (T-014..T-017) con sus hilos, autores y estados.
-- Guardado: solo se siembra si existen los perfiles demo (@wowinx.com) -- un proyecto de
-- producción real no los tiene y esta migración no le inserta nada. Se numera con la
-- secuencia (14..17) y se deja lista para que el siguiente sea T-018.
-- =============================================================================
do $$
declare
  v_marta uuid := (select id from perfil where email = 'marta.gil@wowinx.com');
  v_enrique uuid := (select id from perfil where email = 'enrique.robles@wowinx.com');
  v_ana uuid := (select id from perfil where email = 'ana.ruiz@wowinx.com');
  v_leo uuid := (select id from perfil where email = 'leo.silva@wowinx.com');
  v_cristian uuid := (select id from perfil where email = 'cristian.haro@wowinx.com');
  t14 uuid; t15 uuid;
begin
  if v_marta is null or v_enrique is null or v_ana is null or v_leo is null or v_cristian is null then
    return;
  end if;
  perform setval('ticket_ref_seq', 13);

  insert into ticket (creado_por, titulo, descripcion, tipo, estado, creado_en) values
    (v_leo, 'El botón atrás en móvil me sacaba de la ficha',
     'Al entrar en un día desde el calendario y dar atrás, la app se cerraba en vez de volver.',
     'incidencia', 'resuelto', '2026-09-09 09:15+02')
  returning id into t14;
  insert into ticket (creado_por, titulo, descripcion, tipo, estado, creado_en) values
    (v_ana, 'Poder duplicar las líneas de ayer',
     'Casi todos mis días son iguales. Un botón de "copiar el día anterior" me ahorraría el 90% de los clics.',
     'mejora', 'en_curso', '2026-09-10 10:05+02')
  returning id into t15;
  insert into ticket (creado_por, titulo, descripcion, tipo, estado, creado_en) values
    (v_enrique, '¿Cómo pido vacaciones de medio día?',
     'Necesito librar solo la tarde del viernes 26 y el formulario de ausencias solo me deja días completos.',
     'consulta', 'abierto', '2026-09-11 11:20+02'),
    (v_marta, 'En el Excel FTE la columna Permisos sale vacía',
     'He descargado el FTE de agosto y la columna Permisos aparece sin valores para todo el equipo, aunque Enrique tuvo un permiso de 2 días.',
     'incidencia', 'abierto', '2026-09-11 12:40+02');

  insert into ticket_comentario (ticket_id, autor_id, texto, creado_en) values
    (t14, v_cristian, 'Reproducido. Era un fallo de navegación general.', '2026-09-10 09:30+02'),
    (t14, v_cristian, 'Resuelto en la última versión — prueba y me dices.', '2026-09-11 09:10+02'),
    (t14, v_leo,      'Confirmado, ya funciona. ¡Gracias!', '2026-09-11 09:45+02'),
    (t15, v_cristian, 'Buena idea — lo pasamos a la lista de mejoras. Mientras tanto, el carrusel de últimos días te deja copiar línea a línea.', '2026-09-10 10:40+02');
end;
$$;
