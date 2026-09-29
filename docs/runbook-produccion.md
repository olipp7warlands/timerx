# Runbook de producción — proyecto Supabase NUEVO + Railway propio

> **EJECUTADO — 2026-09-22.** Todas las fases (Paso 0, 1, 2, 3, 4, 5) están hechas y verificadas. Producción vive en el proyecto Supabase `horasgrupo-prod` y el servicio Railway `timerx-prod` (+ cron gemelo), con la primera cuenta admin_grupo real y nada más. Ver `docs/dia-1.md` para el resumen de entrega al usuario.
> Este documento manda sobre cualquier versión anterior. La **demo queda intacta** (herramienta comercial, 13 cuentas, proyecto Supabase `klmtskdbewukffuziusg` y servicios Railway `timerx` + `timerx-cron-recordatorios`): nada de este runbook la modifica.

## 0. Decisiones cerradas

- Producción = proyecto Supabase **nuevo** (región europea) + servicios Railway **propios** (`timerx-prod` y su cron gemelo), desde el mismo repo, **rama `produccion`** (§12).
- Producción **nace sin historia**: estructura real del grupo + **una** cuenta admin_grupo. Sin tarifas, asignaciones, imputaciones, ausencias, cierres, tickets ni logs.
- **Sin email** (decisión definitiva por ahora): `MODO_EMAIL=log`; alta de cuentas **a mano** (usuario + contraseña inicial entregada en mano) o por plantilla; sin contraseña compartida.
- El registro público de Auth está **cerrado** y la API de datos nunca es accesible para `anon` (migraciones 023–025).
- **Respuestas del usuario (2026-09-19)**: organización = «olipp7warlands's Org»; **backups diarios bastan, sin PITR** (13 personas, carga baja; PITR anotado como mejora si el uso crece); región **París (`eu-west-3`)**; proyecto **`horasgrupo-prod`**; creación por el CLI con el coste autorizado y contraseña de BD aleatoria mostrada UNA vez; jornada 8/8/8/8/5,5/0/0 **igual en las tres empresas**; catálogo derivado de la demo **confirmado**; **`descripcion_obligatoria` arranca en `false`** (activarla después es un clic en Ajustes y solo afecta a líneas nuevas, 012); dominio = subdominio Railway por ahora (dominio propio = tarea posterior); **despliegue por rama `produccion` promovida a mano** (`main` = demo con autodeploy); Railway `europe-west4`.

## 1. Reconciliación con el runbook anterior (este prompt manda)

| Tema | Runbook anterior | Ahora |
|---|---|---|
| Migraciones | «001 a 019» | **24 archivos**: 001, 002, 004–025 (**no existe la 003**) |
| Seed | «no ejecutar `seed_datos.sql`; sembrar lo estable» (sin archivo) | `supabase/seed-produccion.sql` (nuevo, con veredicto por sección y autocomprobación) |
| Dominio | prerrequisito «dominio propio» | subdominio Railway salvo que el usuario aporte dominio (PAUSA) |
| Railway | «servicio nuevo o environment» | servicio nuevo `timerx-prod` + **cron gemelo** (imagen `curlimages/curl`, `0 8 * * *`, `CRON_SECRET` **nuevo**); la demo no se toca |
| Variables | 3 de Supabase, «sin `MODO_EMAIL`» | + `CRON_SECRET` (nuevo), `MODO_EMAIL=log`, `APP_URL` (dominio de producción) |
| Auth `config push` | «archivo mínimo de 2 claves» | **falso** (lección de la 023): el CLI rellena con sus defaults lo no declarado. Diff previo obligatorio, valores remotos fijados, cambio de una línea |
| RLS «sesión anónima = 0 filas» | se comprobaba así | desde la 024 `anon` recibe **`42501 permission denied`** en las 21 tablas (no `[]`) |
| Primera cuenta | «desde Usuarios» (imposible sin admin) | **bootstrap** con `scripts/bootstrap-admin.mjs` |
| Desactivar cuenta | «no bloquea el login» | bloquea todo: `activo=false` + ban de Auth + pre-request (025, Paso 0) |
| Backups | no mencionados | **condición de entrega** (fase 2, paso 7) |
| Verificación de seguridad | ausente | consultas de catálogo y sondas (sección 9) |

## 2. PAUSA — respondida por completo (2026-09-19 y 2026-09-22)

Organización «olipp7warlands's Org», backups diarios sin PITR (Pro confirmado por el usuario en Billing), región París, proyecto `horasgrupo-prod`, creación por CLI con contraseña de BD generada y mostrada una vez, jornada 8/8/8/8/5,5/0/0 igual en las tres empresas, catálogo confirmado, `descripcion_obligatoria=false`, dominio = subdominio Railway, despliegue por rama `produccion` promovida a mano, Railway `europe-west4`.

Los 3 datos que faltaban se cerraron el 2026-09-22, con una decisión adicional sobre los CIF:
1. **CIF**: el usuario decidió **no darlos ahora**; se fijan uno a uno desde Empresas → ficha → Editar datos (admin_grupo, ya existe en la app). El seed siembra las 3 empresas con `cif = null` (columna `text unique` sin CHECK de formato: varios `NULL` conviven sin chocar). Tarea de día 1, ver `docs/dia-1.md`.
2. **Primer admin_grupo**: Oliver Perez Parada, `oliver.perez@wowinx.com`, empresa Wowinx SL. Contraseña inicial dada explícitamente por el usuario (no generada por el script en este caso, por decisión suya); se cambia en el primer login.
3. **Plan Pro**: confirmado por el usuario en Billing.

## 3. Paso 0 — I-residual (HECHO, en la demo; viaja a producción con el código y la migración 025)

Desactivar una cuenta ahora es **`perfil.activo = false` + ban de Auth** (server action `desactivarUsuario`, con `permisos.ts` mandando: `errorCambiarActivo`, mismos límites que la 022, y **nadie se desactiva a sí mismo**); reactivar = unban + `activo = true`. **Medido**: el ban solo corta login y refresco; un JWT ya emitido **seguía sirviendo datos** en PostgREST (200) hasta caducar (hasta 1 h). Por eso la **migración 025** añade un *pre-request* de PostgREST (`pgrst.db_pre_request`) que rechaza con **403 `PT403 «Cuenta desactivada»`** cualquier petición (tablas, vistas, RPC) de una cuenta con `activo = false`. Verificado con la demo desplegada: JWT emitido antes de desactivar → 403 en PostgREST, `user_banned` en Auth (usuario, refresco y login) → reactivar → el mismo JWT vuelve a servir y el login entra. Rollback: `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.

## 4. Fase 1 — Seed de producción (HECHA y validada)

`supabase/seed-produccion.sql`, derivado de `seed.sql` contrastado con el **estado vivo** de la demo. **Incluye**: 3 empresas (CIF = marcadores `@@CIF_…@@` a sustituir), 3 departamentos (sin `responsable_id`), 4 categorías con su departamento, 14 subcategorías, **6 áreas y 22 elementos del mapa**, 7 proyectos (sin tarifas ni asignaciones), tipologías (Wowinx → Tecnología, Málaga → Deportes, Legal Norte → sin), jornada 8/8/8/8/5,5/0/0, ajustes de producción. **Excluye**: cuentas, imputaciones, ausencias, tarifas, `coste_empleado`, tickets, cierres, `recordatorio_log` **y los restos de pruebas de la demo** (2 áreas y 2 elementos «de prueba F6», inactivos). **Ya sembrado por migración**: 8 festivos 2026 (002).

Trampa documentada: la 002 siembra `jornada_horas = 7` y el trigger de la 019 crea la jornada de cada empresa **al insertarla**; por eso el seed fija los `ajuste` **antes** de insertar empresas. **Validación hecha**: aplicado sobre una copia emulada de proyecto nuevo (transacción abortada sobre la demo: vaciado + re-siembra de lo que hacen las migraciones + seed), su autocomprobación pasó y dio 3/3/4/14/6/22/7/21/8/5 filas, Wowinx `1:8 2:8 3:8 4:8 5:5.5 6:0 7:0`; la demo quedó intacta (conteos y huella idénticos). El seed **aborta** si la base ya tiene datos, si quedan marcadores de CIF o un CIF con formato inválido, o si los conteos no son los declarados.

## 5. Fase 2 — Proyecto Supabase nuevo (HECHA por completo)

1. **Proyecto creado**: `horasgrupo-prod`, ref `duksjzgoipwwrjvvgzon`, West EU (Paris), org `taoayskuzxsukdabutqq`. El `ref`, la URL y las claves (`anon`, `service_role`) viven solo en `prod.env` (fuera del repo) y en las variables de Railway; nunca en el repo, en `.env.local` compartido ni en este documento.
2. **Migraciones**: `supabase link --project-ref duksjzgoipwwrjvvgzon` **desde el worktree** `../TimerX-prod` (nunca en la carpeta principal); `db push --dry-run` listó exactamente 24 archivos; `db push` las aplicó sin ediciones (historial 24/24, sin restos de sondas). **Censo verificado con sonda temporal de solo lectura** (`NNN_probe_tmp.sql`, migración que aborta con `raise exception`, aplicada y borrada en el acto): **21 tablas · 4 vistas · 1 secuencia · 53 funciones (8 de trigger) · 7 triggers · 43 policies · 46 índices · 20 PK · 35 FK · 16 CHECK · 12 UNIQUE · 7 enums · RLS en 21/21 · `authenticator` con `pgrst.db_pre_request = public.cuenta_desactivada_pre_request`** — idéntico al objetivo. Catálogo de privilegios de `anon`: 0 funciones ejecutables (salvo el pre-request) y 0 tablas/vistas/secuencias.
3. **`config.toml` y Auth**: en la rama `produccion` (commit `373e0e9`), `project_id`, `site_url` (`https://timerx-prod-production.up.railway.app`) y `additional_redirect_urls` estrictos (sin `localhost`); `echo n | supabase config push` mostró el diff previsto y nada más (`site_url`, `additional_redirect_urls`, `enable_signup: true → false`; MFA/email/OTP remotos ya coincidían); aplicado con `echo y | supabase config push`. Verificado: `GET $URL/auth/v1/settings` → `disable_signup: true`, `mailer_autoconfirm: false`; un `signUp` real → `422 signup_disabled`, 0 usuarios en Auth tras el intento.
4. **Seed — APLICADO (2026-09-22)**: CIF cambiado a `null` para las 3 empresas (decisión §2; la autocomprobación pasa a exigir `cif is null` en vez de un formato). Validado antes en una transacción abortada directamente sobre producción (migración de sonda con el seed completo + `raise exception` final: pasó sus 17 sentencias y la autocomprobación, sin dejar nada escrito). Aplicado de verdad con `db push --include-seed` (`[db.seed] sql_paths` temporal en `config.toml`, revertido con `git checkout` al terminar). Conteos verificados uno a uno tras aplicar: 3/3/4/14/6/22/7/21/8/5, las 3 empresas con `cif: null`, tipologías y jornada 8/8/8/8/5,5/0/0 correctas.
5. **Verificaciones 023/024/025 con LA ANON KEY DEL PROYECTO NUEVO — HECHAS**: las 25 tablas/vistas expuestas (incluye las 4 vistas) → `GET` con `42501`; escrituras (`UPDATE`/`INSERT`/`DELETE`) → `42501`; las 18 RPC con parámetros inválidos (norma C) → `42501`; conteos antes/después idénticos. Repetido tras el seed y tras la Fase 4 (con datos y cuenta real ya presentes): sigue todo denegado. Guion: `verif_prod_anon.mjs` (scratchpad; lee solo `prod.env`, nunca imprime claves).
6. **Bootstrap — HECHO (2026-09-22)**: `node scripts/bootstrap-admin.mjs --proyecto duksjzgoipwwrjvvgzon --nombre "Oliver Perez Parada" --email "oliver.perez@wowinx.com" --empresa "Wowinx SL" --password …` (contraseña dada explícitamente por el usuario, mostrada una única vez en el chat, no guardada en ningún archivo). Cuenta creada: rol `admin_grupo`, `activo=true`.
7. **Backups — comprobado**: `supabase backups list --project-ref duksjzgoipwwrjvvgzon -o json` → un backup físico `COMPLETED` a los 5 minutos de crear el proyecto, `walg_enabled: true`, `pitr_enabled: false` (decisión §0: diarios bastan, sin PITR). **Plan Pro confirmado por el usuario en Billing** (2026-09-22).

## 6. Fase 3 — Railway producción (HECHA)

- **Servicio `timerx-prod`** (id `2608441b-81b1-429c-becd-2995684f8130`) creado desde el repo, **rama `produccion`**, movido a `europe-west4` (`railway scale`, los servicios nacen en `us-east4` por defecto). Dominio generado: `timerx-prod-production.up.railway.app`. Variables propias fijadas por `railway variable set --stdin --skip-deploys` (nunca por el chat): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (del proyecto nuevo), `CRON_SECRET` nuevo (32 bytes aleatorios, distinto al de la demo), `MODO_EMAIL=log`, `APP_URL` fijado antes del primer deploy. Build `SUCCESS`; `/login` → 200, `/admin` → 307 a login, el bundle público solo contiene la URL de Supabase de producción.
- **Cron gemelo `timerx-prod-cron-recordatorios`** (id `895f8aec-fc8d-4200-94ba-f96fa4bbfb99`): imagen `curlimages/curl:latest`, `europe-west4`, `cronSchedule` `0 8 * * *`, `startCommand` `sh -c 'curl -sS --fail-with-body --retry 3 --retry-delay 10 --retry-all-errors -X POST -H "Authorization: Bearer $CRON_SECRET" "$TARGET_URL"'`, variables `CRON_SECRET` (el mismo del servicio prod) y `TARGET_URL` = `https://timerx-prod-production.up.railway.app/api/cron/recordatorios`. Probado con una ejecución real: HTTP 200, `{"modo":"desactivado",...}` (el ajuste `recordatorio_email` está en `false`, como en la demo antes de tener usuarios).
- Dominio: subdominio Railway (decisión §0); dominio propio queda como tarea posterior documentada.
- **La demo y su cron quedaron EXACTAMENTE como estaban**: `timerx` y `timerx-cron-recordatorios` verificados en verde, mismas variables, mismo `us-east4`. El único cambio en la demo es el `startCommand` de su cron (ver nota siguiente), decidido explícitamente por el usuario fuera de la congelación de seguridad.
- **Robustez del cron (no seguridad, decisión del usuario 2026-09-21)**: el cron de la demo tenía un `CRASHED` intermitente (`curl -sf`, que calla el error y no reintenta; la red del contenedor no está lista en el primer segundo). Se aplicó a **los dos crones** (demo y gemelo) el mismo `startCommand` con `-sS --fail-with-body --retry 3 --retry-delay 10 --retry-all-errors`. Probado con disparos reales en ambos: el primer intento falla y el reintento a los 10 s entrega 200. Horario de los dos restaurado a `0 8 * * *` tras la prueba.

## 7. Fase 4 — Verificación de estreno (HECHA, 2026-09-22)

Contra producción real, con 3 cuentas de prueba (`prueba.f4.empleado@wowinx.com`, `prueba.f4.adminempresa@wowinx.com`, `prueba.f4.malaga@malagacf.com`) creadas con contraseñas aleatorias (nunca mostradas, no hacía falta: todo por login explícito con magic link → sesión real) y **borradas al final**. Ningún periodo se cerró en producción.
- **Ciclo mínimo — todo en verde**: admin (Oliver) asigna al empleado de prueba al proyecto Ximeras → el empleado inserta una imputación en borrador → la envía (`enviar_imputaciones`) → lee su `balance_mes` y el mapa → crea un ticket de soporte → el admin la aprueba (`aprobar_imputaciones`), lee `balance_mes_empleado` (ficha), comenta el ticket, lee el hilo (`ticket_hilo`) y lo resuelve. El ticket de prueba salió con `ref = T-001` (base sin tickets previos).
- **Spot-check de permisos (cuentas reales, sesión real, no `anon`)**:
  - Un empleado (no admin) llamando a `imputar_directo` → `42501` (guarda de rol).
  - Un admin_empresa de Wowinx intentando `UPDATE` sobre el perfil del admin_grupo → 0 filas (RLS).
  - Un admin_empresa de Wowinx llamando a `cerrar_periodo` de Málaga → `42501`.
  - Un admin_empresa de Wowinx asignando (`empleado_proyecto`) a un empleado de **Málaga** en un proyecto de Wowinx → **sin error, escribió**. Es un hallazgo real, no un fallo del guion: la policy `ep_admin` solo comprueba la empresa del PROYECTO, no la del EMPLEADO. Documentado como **backlog M** (`docs/seguridad-backlog.md`); no crítico (requiere una cuenta admin_empresa de confianza, no `anon`), no abre migración por la congelación de seguridad.
  - Imputación **cerrada** inmutable (024): probado forzando el estado a mano en una migración de sonda que ABORTA la transacción entera (nunca se cerró ningún periodo real) — UPDATE y DELETE bloqueados los dos por el trigger `imputacion_cerrada_inmutable`.
  - Desactivar/reactivar con JWT vigente (Paso 0), repetido contra producción con la cuenta de prueba: JWT emitido antes → tras desactivar da `PT403` en tablas y `user_banned` en Auth → tras reactivar el MISMO JWT vuelve a servir.
- **Deep-link / atrás / F5 / móvil**: hecho **sin sesión autenticada** — inyectar una sesión real en el navegador (cookie con el JWT) quedó bloqueado por el clasificador de permisos del propio Claude Code («materialización de credenciales»); no se intentó saltar. Verificado sin sesión: `/admin/proyectos` → redirige a `/login?next=%2Fadmin%2Fproyectos` (deep-link preservado); F5 sobre esa URL recarga limpio conservando el `next`; el viewport de 390 px no se pudo forzar en este entorno de navegador (limitación del entorno, no de la app). **Pendiente**: el usuario debería hacer una pasada rápida de deep-link/atrás/F5/móvil ya autenticado, y confirmar el flujo de «cambiar contraseña» (`CambiarPasswordForm`) desde el menú de su avatar en el primer login.
- **Hallazgo colateral (no de seguridad)**: `/auth/callback` calcula mal su origen detrás de Railway (`localhost:8080` en vez del dominio público) — **también está en la demo**, es previo a este runbook. Hoy no afecta a nadie (login es por contraseña, sin email); bloquearía magic link/recuperación por email si se activa el correo (§11). Documentado como **backlog N**.
- **Revertido por completo**: ticket + comentario borrados, `ticket_ref_resincronizar()` ejecutado (el próximo ticket real será T-001), imputación y asignación de prueba borradas, las 3 cuentas de prueba borradas (cascada a `empleado_proyecto`; nada más colgaba de ellas). Conteos finales verificados uno a uno: exactamente el seed estructural (3/3/4/14/6/22/7/21/8/5) + **1 perfil** (Oliver, admin_grupo, activo) y **0** en el resto de tablas transaccionales. 1 usuario en Auth.

## 8. Fase 5 — Entrega (HECHA)

Este documento pasa a «ejecutado» (ver cabecera); `docs/dia-1.md` escrito para el usuario (URL, su cuenta, checklist de estreno, tareas de día 1); entrada final «Producción» en `PLAN.md`; la demo queda documentada como entorno comercial con sus 13 cuentas (sin cambios de esta ejecución salvo el `startCommand` del cron, §6).

## 9. Verificación de seguridad (en la fase 2 y periódica: cada release y al menos mensual)

Norma de proyecto L: **nada se crea desde el panel de Supabase; todo entra por migración**. En el SQL Editor **las dos consultas devuelven 0 filas**:

- Funciones (única excepción documentada: el pre-request de la 025, que PostgREST ejecuta con el rol de la petición): `select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname <> 'cuenta_desactivada_pre_request' and has_function_privilege('anon', p.oid, 'execute');`
- Tablas, vistas y secuencias: `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and ((c.relkind in ('r','v','m','p','f') and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')) or (c.relkind = 'S' and has_sequence_privilege('anon', c.oid, 'usage, select, update')));`

Si devuelven filas se corrige con una migración (`revoke … from anon`), no a mano. Comprobación externa equivalente con la **anon key del bundle desplegado**: `GET /rest/v1/<tabla>` → `42501 permission denied` (no `[]`); sondas con parámetros inválidos (norma C) a las funciones con efectos → `42501`; `signUp` → `422 signup_disabled`; una cuenta creada por Admin API con `{"rol":"admin_grupo"}` en los metadatos nace `empleado`. Detalle y límites en `docs/seguridad-backlog.md`.

## 10. Todo lo que hoy es «demo» y no debe llegar a producción

| Elemento | Dónde vive | Por qué no vale para producción |
|---|---|---|
| Contraseña compartida `Horas2026!` | `scripts/set-passwords.mjs` | Credencial única compartida entre las cuentas de demo. |
| Seed ficticio completo | `scripts/seed-usuarios.mjs`, `supabase/seed.sql`, `supabase/seed_datos.sql` | Empresas con CIF ficticios, imputaciones, ausencias y tarifas de ejemplo. **En producción solo `seed-produccion.sql`.** |
| 3 líneas `enviada` de F5, tickets T-014..T-017, 12 h sin tarifa «a propósito» | `seed_datos.sql`, migración 018, datos de F3/F4 | Escenarios de demostración. En un proyecto nuevo la 018 no inserta tickets (no hay perfiles demo). |
| `olcasan08@gmail.com` como empleado | demo | Acceso del propietario a la demo desde el móvil; no es un usuario del cliente. |
| `additional_redirect_urls` con `localhost` | `supabase/config.toml` | Estricto al dominio de producción. |
| Dominio `timerx-production.up.railway.app` y el `APP_URL` por defecto de `lib/recordatorios/enviar.ts` | Railway / código | Dominio de demo: fijar `APP_URL` en producción. |
| Restos de pruebas en el mapa | tablas `mapa_*` de la demo | 2 áreas y 2 elementos «de prueba F6» (inactivos): excluidos del seed. |

## 11. Futuro opcional: activar email

Decisión de producto **definitiva por ahora: sin email**. Todo lo que dependía del correo queda DORMIDO, no retirado:

| Pieza | Estado hoy (demo y producción) | Para activarlo (futuro) |
|---|---|---|
| Invitaciones (`inviteUserByEmail`) | Dormido: el alta manual y el importador crean la cuenta confirmada sin enviar nada (`createUser`). El modo `invitar` sigue en `src/lib/usuarios/alta.ts` | `MODO_EMAIL=real` **y SMTP propio en Supabase Auth** |
| Recovery («¿Olvidaste tu contraseña?») | Construido pero **inerte** (no llega el enlace): un admin usa «Restablecer contraseña» en la ficha | Mismo SMTP propio + dominio de envío verificado |
| Recordatorios (cron diario + botón «Recordar») | Registran en `recordatorio_log` **sin enviar** (`MODO_EMAIL` ≠ `real`) | Cuenta Resend + dominio verificado + `RESEND_API_KEY` + `MODO_EMAIL=real` |
| Magic link de acceso | Solo para verificación técnica con cuentas de demo | — |

## 12. Flujo de promoción: `main` (demo) → `produccion`

- **Ramas**: `main` = demo, autodeploy en Railway `timerx`. **`produccion`** = producción, autodeploy en Railway `timerx-prod` (y el cron gemelo apunta a su dominio). Producción solo se mueve cuando el usuario **promociona** empujando a `produccion`. La rama se creó desde el commit verificado `8f31efd`.
- **Dos carpetas de trabajo** (evita mezclar enlaces del CLI): la carpeta principal (`main`, enlazada a la **demo** `klmtskdbewukffuziusg`) y un *worktree* de `produccion` (`git worktree add ../TimerX-prod produccion`), enlazado al proyecto de producción. **Todo comando `supabase` de producción se ejecuta desde el worktree**; nunca se hace `supabase link` en la carpeta principal.
- **`supabase/config.toml` difiere entre ramas** (`project_id`, `site_url`, `additional_redirect_urls` de producción): esa diferencia vive solo en `produccion`; al promocionar, si hubiera conflicto en ese archivo se conserva la versión de `produccion`.
- **Promocionar** (desde el worktree de `produccion`):
  1. Verificar en la demo/`main` lo que se va a promover (build, pruebas, huella canónica) y anotar el commit.
  2. `git merge --no-ff main` (o `git merge <commit>`); resolver `config.toml` conservando el de producción.
  3. `supabase db push --dry-run`: lista las migraciones nuevas. Si las hay, **primero** `supabase db push` (las migraciones son aditivas y compatibles con el código anterior), y comprobar el censo de objetos.
  4. `git push origin produccion` → Railway despliega `timerx-prod`.
  5. Verificaciones post-deploy de la sección 9 (anon, registro cerrado, cabeceras) y un login real.
- **Rollback**: `git revert` del merge en `produccion` y push (el código vuelve al estado previo); las migraciones no se deshacen (son aditivas: una migración defectuosa se corrige con otra).
- **Nunca** se empuja a `produccion` desde otra rama ni se edita a mano en el panel de Railway/Supabase (norma L).
- **Qué carpeta es cuál**: cada worktree lleva un `ENTORNO.md` en su raíz que lo dice y trae el `git worktree list` (locales, excluidos de git): [`../TimerX/ENTORNO.md`](../ENTORNO.md) (rama `main` = DEMO, trabajo diario) y [`../TimerX-prod/ENTORNO.md`](../../TimerX-prod/ENTORNO.md) (rama `produccion` = PRODUCCIÓN REAL, solo promociones de esta sección). Migraciones pendientes de promoción tras el lote v1.2+v1.3: **027 y 028** (la 026 viajó ya con la promoción de v1.1; ver PLAN.md).
- **Promociones ejecutadas** (registro; cada una siguió los pasos 1–5 de arriba, con `config.toml` de producción intacto):
  - 2026-09-24 · v1.1 (`bb1d852`) → merge `79b2b40` · migración **026**.
  - 2026-09-25 · v1.2+v1.3 (`274b03e`) → merge `290eed3` · migraciones **027** (notificaciones de Soporte) y **028** (guarda del último admin_grupo). Censo tras el push: 22 tablas · 4 vistas · 1 secuencia · 57 funciones (10 de trigger) · 9 triggers · 46 policies · 47 índices · 21 PK · 38 FK · 16 CHECK · 12 UNIQUE · 7 enums · RLS 22/22; `anon` sin EXECUTE ni privilegios de tabla.
  - 2026-09-25 · v1.4 + 029 (`181c9f1`) → merge `1c35e91` · migración **029** (jornada por defecto de empresas nuevas = `ajuste.jornada_semanal_defecto` `[8,8,8,8,5.5,0,0]`; backfill del viernes de «Oli FC»). Censo tras el push: 59 funciones (11 de trigger) · 10 triggers (`ajuste_validar`), el resto igual; conteos idénticos salvo `ajuste` 5→6. Las 3 empresas del seed intactas (8/8/8/8/5,5/0/0).
  - Limpieza posterior (2026-09-25, decidida por el propietario): la empresa de prueba «Oli FC» (con su proyecto «OliTOP», su asignación y sus 7 filas de jornada) se borró por script service_role con recomprobación previa (sin imputaciones, perfiles, periodos ni festivos colgando): empresa 4→3, proyecto 8→7, `empleado_proyecto` 8→7, `empresa_jornada` 28→21.
  - **Migraciones en producción: 001–029 (sin la 003, que no existe).** No queda ninguna pendiente de promoción.
- **Ya ejecutado una vez** (2026-09-19/21): worktree creado, `timerx-prod` desplegado desde `produccion` en el commit `8f31efd`, `config.toml` propio commiteado y pusheado (`373e0e9`). Los próximos pasos de este flujo (2–5) se repiten en cada promoción posterior.

## 13. Pendiente del usuario tras la entrega

- **Rotar la contraseña de la base de datos** de `horasgrupo-prod` desde el panel de Supabase (Project Settings → Database). La actual (generada por el CLI, mostrada una vez el 2026-09-19) vive en el gestor de contraseñas del usuario; tras la entrega deja de ser la única copia fiable y el usuario decidió rotarla él mismo. Anotado también en `docs/dia-1.md`.
- **Fijar los CIF reales de las 3 empresas** desde Empresas → ficha → Editar datos (decisión §2). Anotado en `docs/dia-1.md`.
- **Cambiar la contraseña inicial** de `oliver.perez@wowinx.com` en el primer login (menú del avatar → Cambiar contraseña) y, de paso, confirmar que ese formulario funciona en producción (Fase 4 no pudo probarlo con una sesión real por la restricción de credenciales del propio Claude Code).
- Backlog abierto sin urgencia: **M** (un admin_empresa puede asignar a su proyecto un empleado de otra empresa) y **N** (`/auth/callback` calcula mal su origen detrás de Railway; bloquea activar email hasta corregirse) — `docs/seguridad-backlog.md`.

