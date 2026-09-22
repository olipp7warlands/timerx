# Runbook de producción — proyecto Supabase NUEVO + Railway propio

> **Estado a 2026-09-22** — Paso 0 **HECHO** · Fase 1 **HECHA y validada** · PAUSA **respondida** (sección 2) salvo 3 datos aún sin rellenar · Fase 2 **HECHA la parte técnica** (proyecto, migraciones, censo, permisos de `anon`, `config push`, backups); **bloqueada** en seed/bootstrap por esos 3 datos · Fase 3 **HECHA** (Railway `timerx-prod` + cron gemelo; demo verificada intacta) · Fases 4–5 **pendientes** de que el bootstrap cree la primera cuenta.
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

## 2. PAUSA — respondida (2026-09-19), salvo 3 datos aún sin rellenar

El usuario respondió los puntos A/B/C/D (recogido en la sección 0). Lo único que sigue **bloqueando** el seed y el bootstrap (pedido dos veces, llegó como plantilla `[tu CIF]` / `[tu nombre completo]` / `[tu email real]` / `[sí — confirmado…]` ambas veces):

1. **CIF real de las 3 empresas**, sin guiones (Wowinx SL, Málaga CF SAD, Legal Norte SL).
2. **Nombre y apellidos + email real** del primer admin_grupo (empresa Wowinx SL). La contraseña la genera el script y se muestra una vez.
3. **Confirmación del plan Pro** mirando Billing en el panel de Supabase (yo no tengo sesión en el navegador ni la abro con contraseñas). Indicios a favor: el proyecto se creó con el coste autorizado, hay un backup físico `COMPLETED` y `walg_enabled: true` (ver §5, paso 7).

Todo lo demás de A/B/C/D ya está aplicado: organización «olipp7warlands's Org», backups diarios sin PITR, región París, proyecto `horasgrupo-prod`, creación por CLI con contraseña de BD generada y mostrada una vez, jornada 8/8/8/8/5,5/0/0 igual en las tres empresas, catálogo confirmado, `descripcion_obligatoria=false`, dominio = subdominio Railway, despliegue por rama `produccion` promovida a mano, Railway `europe-west4`.

## 3. Paso 0 — I-residual (HECHO, en la demo; viaja a producción con el código y la migración 025)

Desactivar una cuenta ahora es **`perfil.activo = false` + ban de Auth** (server action `desactivarUsuario`, con `permisos.ts` mandando: `errorCambiarActivo`, mismos límites que la 022, y **nadie se desactiva a sí mismo**); reactivar = unban + `activo = true`. **Medido**: el ban solo corta login y refresco; un JWT ya emitido **seguía sirviendo datos** en PostgREST (200) hasta caducar (hasta 1 h). Por eso la **migración 025** añade un *pre-request* de PostgREST (`pgrst.db_pre_request`) que rechaza con **403 `PT403 «Cuenta desactivada»`** cualquier petición (tablas, vistas, RPC) de una cuenta con `activo = false`. Verificado con la demo desplegada: JWT emitido antes de desactivar → 403 en PostgREST, `user_banned` en Auth (usuario, refresco y login) → reactivar → el mismo JWT vuelve a servir y el login entra. Rollback: `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.

## 4. Fase 1 — Seed de producción (HECHA y validada)

`supabase/seed-produccion.sql`, derivado de `seed.sql` contrastado con el **estado vivo** de la demo. **Incluye**: 3 empresas (CIF = marcadores `@@CIF_…@@` a sustituir), 3 departamentos (sin `responsable_id`), 4 categorías con su departamento, 14 subcategorías, **6 áreas y 22 elementos del mapa**, 7 proyectos (sin tarifas ni asignaciones), tipologías (Wowinx → Tecnología, Málaga → Deportes, Legal Norte → sin), jornada 8/8/8/8/5,5/0/0, ajustes de producción. **Excluye**: cuentas, imputaciones, ausencias, tarifas, `coste_empleado`, tickets, cierres, `recordatorio_log` **y los restos de pruebas de la demo** (2 áreas y 2 elementos «de prueba F6», inactivos). **Ya sembrado por migración**: 8 festivos 2026 (002).

Trampa documentada: la 002 siembra `jornada_horas = 7` y el trigger de la 019 crea la jornada de cada empresa **al insertarla**; por eso el seed fija los `ajuste` **antes** de insertar empresas. **Validación hecha**: aplicado sobre una copia emulada de proyecto nuevo (transacción abortada sobre la demo: vaciado + re-siembra de lo que hacen las migraciones + seed), su autocomprobación pasó y dio 3/3/4/14/6/22/7/21/8/5 filas, Wowinx `1:8 2:8 3:8 4:8 5:5.5 6:0 7:0`; la demo quedó intacta (conteos y huella idénticos). El seed **aborta** si la base ya tiene datos, si quedan marcadores de CIF o un CIF con formato inválido, o si los conteos no son los declarados.

## 5. Fase 2 — Proyecto Supabase nuevo (parte técnica HECHA; seed/bootstrap bloqueados por §2)

1. **Proyecto creado**: `horasgrupo-prod`, ref `duksjzgoipwwrjvvgzon`, West EU (Paris), org `taoayskuzxsukdabutqq`. El `ref`, la URL y las claves (`anon`, `service_role`) viven solo en `prod.env` (fuera del repo) y en las variables de Railway; nunca en el repo, en `.env.local` compartido ni en este documento.
2. **Migraciones**: `supabase link --project-ref duksjzgoipwwrjvvgzon` **desde el worktree** `../TimerX-prod` (nunca en la carpeta principal); `db push --dry-run` listó exactamente 24 archivos; `db push` las aplicó sin ediciones (historial 24/24, sin restos de sondas). **Censo verificado con sonda temporal de solo lectura** (`NNN_probe_tmp.sql`, migración que aborta con `raise exception`, aplicada y borrada en el acto): **21 tablas · 4 vistas · 1 secuencia · 53 funciones (8 de trigger) · 7 triggers · 43 policies · 46 índices · 20 PK · 35 FK · 16 CHECK · 12 UNIQUE · 7 enums · RLS en 21/21 · `authenticator` con `pgrst.db_pre_request = public.cuenta_desactivada_pre_request`** — idéntico al objetivo. Catálogo de privilegios de `anon`: 0 funciones ejecutables (salvo el pre-request) y 0 tablas/vistas/secuencias.
3. **`config.toml` y Auth**: en la rama `produccion` (commit `373e0e9`), `project_id`, `site_url` (`https://timerx-prod-production.up.railway.app`) y `additional_redirect_urls` estrictos (sin `localhost`); `echo n | supabase config push` mostró el diff previsto y nada más (`site_url`, `additional_redirect_urls`, `enable_signup: true → false`; MFA/email/OTP remotos ya coincidían); aplicado con `echo y | supabase config push`. Verificado: `GET $URL/auth/v1/settings` → `disable_signup: true`, `mailer_autoconfirm: false`; un `signUp` real → `422 signup_disabled`, 0 usuarios en Auth tras el intento.
4. **Seed — BLOQUEADO** (§2): falta sustituir los 3 CIF reales en `seed-produccion.sql` antes de aplicarlo con `db push --include-seed` (`[db.seed] sql_paths` temporal, revertir después) o por el SQL Editor. Comprobar los conteos declarados por el propio seed (3/3/4/14/6/22/7/21/8/5; 0 en el resto).
5. **Verificaciones 023/024/025 con LA ANON KEY DEL PROYECTO NUEVO — HECHAS**: las 25 tablas/vistas expuestas (incluye las 4 vistas) → `GET` con `42501`; escrituras (`UPDATE`/`INSERT`/`DELETE`) → `42501`; las 18 RPC con parámetros inválidos (norma C) → `42501`; conteos antes/después idénticos (0 filas, base vacía). Guion: `verif_prod_anon.mjs` (scratchpad; lee solo `prod.env`, nunca imprime claves).
6. **Bootstrap — BLOQUEADO** (§2): falta nombre, email real del admin y la confirmación de plan. Comando ya validado contra la demo: `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/bootstrap-admin.mjs --proyecto duksjzgoipwwrjvvgzon --nombre … --email … --empresa "Wowinx SL"`.
7. **Backups — comprobado**: `supabase backups list --project-ref duksjzgoipwwrjvvgzon -o json` → un backup físico `COMPLETED` a los 5 minutos de crear el proyecto, `walg_enabled: true`, `pitr_enabled: false` (decisión §0: diarios bastan, sin PITR). **Falta la confirmación del usuario del plan Pro en Billing** (§2, punto 3) antes de dar la fase por entregada.

## 6. Fase 3 — Railway producción (HECHA)

- **Servicio `timerx-prod`** (id `2608441b-81b1-429c-becd-2995684f8130`) creado desde el repo, **rama `produccion`**, movido a `europe-west4` (`railway scale`, los servicios nacen en `us-east4` por defecto). Dominio generado: `timerx-prod-production.up.railway.app`. Variables propias fijadas por `railway variable set --stdin --skip-deploys` (nunca por el chat): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (del proyecto nuevo), `CRON_SECRET` nuevo (32 bytes aleatorios, distinto al de la demo), `MODO_EMAIL=log`, `APP_URL` fijado antes del primer deploy. Build `SUCCESS`; `/login` → 200, `/admin` → 307 a login, el bundle público solo contiene la URL de Supabase de producción.
- **Cron gemelo `timerx-prod-cron-recordatorios`** (id `895f8aec-fc8d-4200-94ba-f96fa4bbfb99`): imagen `curlimages/curl:latest`, `europe-west4`, `cronSchedule` `0 8 * * *`, `startCommand` `sh -c 'curl -sS --fail-with-body --retry 3 --retry-delay 10 --retry-all-errors -X POST -H "Authorization: Bearer $CRON_SECRET" "$TARGET_URL"'`, variables `CRON_SECRET` (el mismo del servicio prod) y `TARGET_URL` = `https://timerx-prod-production.up.railway.app/api/cron/recordatorios`. Probado con una ejecución real: HTTP 200, `{"modo":"desactivado",...}` (el ajuste `recordatorio_email` está en `false`, como en la demo antes de tener usuarios).
- Dominio: subdominio Railway (decisión §0); dominio propio queda como tarea posterior documentada.
- **La demo y su cron quedaron EXACTAMENTE como estaban**: `timerx` y `timerx-cron-recordatorios` verificados en verde, mismas variables, mismo `us-east4`. El único cambio en la demo es el `startCommand` de su cron (ver nota siguiente), decidido explícitamente por el usuario fuera de la congelación de seguridad.
- **Robustez del cron (no seguridad, decisión del usuario 2026-09-21)**: el cron de la demo tenía un `CRASHED` intermitente (`curl -sf`, que calla el error y no reintenta; la red del contenedor no está lista en el primer segundo). Se aplicó a **los dos crones** (demo y gemelo) el mismo `startCommand` con `-sS --fail-with-body --retry 3 --retry-delay 10 --retry-all-errors`. Probado con disparos reales en ambos: el primer intento falla y el reintento a los 10 s entrega 200. Horario de los dos restaurado a `0 8 * * *` tras la prueba.

## 7. Fase 4 — Verificación de estreno (pendiente)

Contra producción real, con la primera cuenta admin y 1–2 cuentas de prueba **que luego se borran**. Reglas: **nunca cerrar un periodo en producción** (una imputación `cerrada` es inmutable —024— y no existe reapertura); cuentas y datos de prueba con **login explícito por identidad** y reversión completa.
- Login del admin → **cambiar contraseña** (flujo propio) → crear una cuenta empleado de prueba con contraseña → login con ella.
- Ciclo mínimo: asignar a un proyecto, imputar, computar, aprobar, ver ficha y mapa, soporte (ticket de prueba → responder → resolver; los tickets no se borran desde la app: se siembra **a propósito**, se elimina con service_role y se llama a `ticket_ref_resincronizar()` para que el **primer ticket real sea T-001**; se declara en el informe).
- Spot-check de la matriz de permisos: `anon` (funciones y tablas), admin_empresa contra cuentas admin_*, imputaciones cerradas inmutables (en transacción abortada), imputación directa acotada, desactivar/reactivar con JWT vigente.
- Deep-link, atrás, F5 y móvil (iframe de 390 px o móvil real; si no, DOM + nota).
- Revertir todo: producción se entrega con **el seed estructural + LA cuenta admin real y nada más**; citar los conteos finales.

## 8. Fase 5 — Entrega (pendiente)

Este documento pasa a «ejecutado» con fechas y referencias (sin claves); `docs/dia-1.md` para el usuario (URL, su cuenta, checklist de estreno); entrada final «Producción» en `PLAN.md`; la demo queda documentada como entorno comercial con sus 13 cuentas.

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
- **Ya ejecutado una vez** (2026-09-19/21): worktree creado, `timerx-prod` desplegado desde `produccion` en el commit `8f31efd`, `config.toml` propio commiteado y pusheado (`373e0e9`). Los próximos pasos de este flujo (2–5) se repiten en cada promoción posterior.

## 13. Pendiente del usuario tras la entrega

- **Rotar la contraseña de la base de datos** de `horasgrupo-prod` desde el panel de Supabase (Project Settings → Database). La actual (generada por el CLI, mostrada una vez el 2026-09-19) vive en el gestor de contraseñas del usuario; tras la entrega deja de ser la única copia fiable y el usuario decidió rotarla él mismo. Anotado también en `docs/dia-1.md`.

