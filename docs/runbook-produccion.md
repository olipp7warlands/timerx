# Runbook de producción — proyecto Supabase NUEVO + Railway propio

> **Estado a 2026-09-19** — Paso 0 **HECHO** · Fase 1 **HECHA y validada** · Fases 2–5 **detenidas en la PAUSA** (faltan datos y decisiones del usuario, sección 2).
> Este documento manda sobre cualquier versión anterior. La **demo queda intacta** (herramienta comercial, 13 cuentas, proyecto Supabase `klmtskdbewukffuziusg` y servicios Railway `timerx` + `timerx-cron-recordatorios`): nada de este runbook la modifica.

## 0. Decisiones cerradas

- Producción = proyecto Supabase **nuevo** (región europea) + servicios Railway **propios** (`timerx-prod` y su cron gemelo), desde el mismo repo y rama `main`.
- Producción **nace sin historia**: estructura real del grupo + **una** cuenta admin_grupo. Sin tarifas, asignaciones, imputaciones, ausencias, cierres, tickets ni logs.
- **Sin email** (decisión definitiva por ahora): `MODO_EMAIL=log`; alta de cuentas **a mano** (usuario + contraseña inicial entregada en mano) o por plantilla; sin contraseña compartida.
- El registro público de Auth está **cerrado** y la API de datos nunca es accesible para `anon` (migraciones 023–025).

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

## 2. PAUSA — lo que necesito del usuario (todo de una vez)

**A. Supabase (fase 2)**
1. **Organización** donde crear el proyecto (el CLI ve tres: «olipp7warlands's Org» —donde vive la demo—, «Doryoku» y «A2A - Agents») y **plan**: producción sin backup **no se entrega**, y los backups programados requieren plan **Pro** (PITR es un add-on de pago). ¿Pro? ¿Contratas PITR o bastan los diarios?
2. **Región** europea (la demo está en Ireland; opciones: Paris, Frankfurt, Ireland, London).
3. **Nombre** del proyecto (p. ej. `TimerX Produccion`).
4. **Cómo lo creo**: (a) tú desde el panel y me pasas el `ref` + las claves, o (b) yo con el CLI ya logueado (`supabase projects create … --org-id … --region …`) **si me autorizas el coste** y una **contraseña de la base de datos** (la genero yo aleatoria y la guardas tú en tu gestor).

**B. Datos reales (fase 1, para cerrar el seed)**
5. **CIF real de las 3 empresas** (Wowinx SL, Málaga CF SAD, Legal Norte SL), sin guiones.
6. **Jornada semanal**: el seed asume 8/8/8/8/5,5/0/0 **igual para las tres**. ¿Son distintas por empresa?
7. Confirmar que el **catálogo derivado de la demo** es el real: 7 proyectos (Ximeras, Triatix, Launcher, Interno → Wowinx; Web corporativa, Masterchef → Málaga; Asesoría intragrupo → Legal Norte), 3 departamentos (3B3, Jurídico, Diseño), 4 categorías con 14 subcategorías, y 6 áreas / 22 elementos del mapa. ¿Falta o sobra algo?
8. **`descripcion_obligatoria`**: la demo la tiene en `false` (por el seed sin descripciones); producción, sin historia previa, podría arrancar en **`true`**. ¿Cuál?

**C. Primera cuenta admin_grupo (fase 2, paso 6)**
9. **Nombre y apellidos**, **email real** y **empresa** a la que pertenece. Recomendación: **no me des una contraseña personal**; el script genera una aleatoria, te la muestro una vez y la cambias al entrar.

**D. Railway (fase 3)**
10. ¿**Dominio propio** (habría que apuntar el DNS) o subdominio de Railway (`timerx-prod-….up.railway.app`)?
11. **Despliegue**: producción sigue `main` con autodeploy (**cada push a `main` desplegaría también producción**) o una rama `produccion` que promueves a mano (recomendado cuando haya datos reales).
12. Región Railway (la demo está en `us-east4`; para producción propongo Europa: `europe-west4`).

## 3. Paso 0 — I-residual (HECHO, en la demo; viaja a producción con el código y la migración 025)

Desactivar una cuenta ahora es **`perfil.activo = false` + ban de Auth** (server action `desactivarUsuario`, con `permisos.ts` mandando: `errorCambiarActivo`, mismos límites que la 022, y **nadie se desactiva a sí mismo**); reactivar = unban + `activo = true`. **Medido**: el ban solo corta login y refresco; un JWT ya emitido **seguía sirviendo datos** en PostgREST (200) hasta caducar (hasta 1 h). Por eso la **migración 025** añade un *pre-request* de PostgREST (`pgrst.db_pre_request`) que rechaza con **403 `PT403 «Cuenta desactivada»`** cualquier petición (tablas, vistas, RPC) de una cuenta con `activo = false`. Verificado con la demo desplegada: JWT emitido antes de desactivar → 403 en PostgREST, `user_banned` en Auth (usuario, refresco y login) → reactivar → el mismo JWT vuelve a servir y el login entra. Rollback: `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.

## 4. Fase 1 — Seed de producción (HECHA y validada)

`supabase/seed-produccion.sql`, derivado de `seed.sql` contrastado con el **estado vivo** de la demo. **Incluye**: 3 empresas (CIF = marcadores `@@CIF_…@@` a sustituir), 3 departamentos (sin `responsable_id`), 4 categorías con su departamento, 14 subcategorías, **6 áreas y 22 elementos del mapa**, 7 proyectos (sin tarifas ni asignaciones), tipologías (Wowinx → Tecnología, Málaga → Deportes, Legal Norte → sin), jornada 8/8/8/8/5,5/0/0, ajustes de producción. **Excluye**: cuentas, imputaciones, ausencias, tarifas, `coste_empleado`, tickets, cierres, `recordatorio_log` **y los restos de pruebas de la demo** (2 áreas y 2 elementos «de prueba F6», inactivos). **Ya sembrado por migración**: 8 festivos 2026 (002).

Trampa documentada: la 002 siembra `jornada_horas = 7` y el trigger de la 019 crea la jornada de cada empresa **al insertarla**; por eso el seed fija los `ajuste` **antes** de insertar empresas. **Validación hecha**: aplicado sobre una copia emulada de proyecto nuevo (transacción abortada sobre la demo: vaciado + re-siembra de lo que hacen las migraciones + seed), su autocomprobación pasó y dio 3/3/4/14/6/22/7/21/8/5 filas, Wowinx `1:8 2:8 3:8 4:8 5:5.5 6:0 7:0`; la demo quedó intacta (conteos y huella idénticos). El seed **aborta** si la base ya tiene datos, si quedan marcadores de CIF o un CIF con formato inválido, o si los conteos no son los declarados.

## 5. Fase 2 — Proyecto Supabase nuevo (pendiente de la PAUSA)

1. **Crear el proyecto** (sección 2-A). El `ref`, la URL y las claves (`anon`, `service_role`) viajan **solo** por variables de entorno de Railway y por el entorno del operador; **nunca en el repo, en `.env.local` compartido ni en este documento**.
2. **`supabase link --project-ref <nuevo>`** y **`supabase db push`** de las 24 migraciones **en orden, sin ediciones**. Antes de empujar: `supabase db push --dry-run` debe listar exactamente 24 archivos. **Comprobar contra la demo** (SQL Editor o sonda de solo lectura): **21 tablas · 4 vistas · 1 secuencia · 53 funciones (8 de trigger) · 7 triggers · 43 policies · 46 índices · 20 PK · 35 FK · 16 CHECK · 12 UNIQUE · 7 enums · RLS en 21/21 · `authenticator` con `pgrst.db_pre_request = public.cuenta_desactivada_pre_request`**. Los mismos números o se investiga.
3. **`config.toml` y Auth** (lección de la 023): editar `project_id` y `site_url`/`additional_redirect_urls` para el proyecto nuevo (estrictos, solo el dominio de producción); **`echo n | supabase config push` y leer el diff**: debe ser SOLO lo pretendido (`site_url`, `additional_redirect_urls`, `enable_signup`), con `[auth.mfa.totp]` y `[auth.email]` fijados a los valores del proyecto nuevo; aplicar con `supabase config push --yes`. **Verificar**: `GET $URL/auth/v1/settings` → `disable_signup: true` y un `signUp` real → `422 signup_disabled`. Cuidado: el `config.toml` del repo apunta a la demo — **revertirlo** (`git checkout supabase/config.toml`) al terminar.
4. **Aplicar el seed**: sustituir los 3 CIF; `supabase db push --include-seed` con `[db.seed] sql_paths = ["./seed-produccion.sql"]` en un `config.toml` **temporal** (revertir después; el `seed.sql` de la demo NO debe usarse). Alternativa si el CLI no lo soporta así: pegar el archivo en el SQL Editor. **Comprobar** los conteos declarados por el propio seed (3 empresas, 3 departamentos, 4 categorías, 14 subcategorías, 6 áreas, 22 elementos, 7 proyectos, 21 filas de jornada, 8 festivos, 5 ajustes; 0 en el resto).
5. **Verificaciones 023/024/025 con LA ANON KEY DEL PROYECTO NUEVO** (sección 9): función y tabla, 0 filas para `anon`; `GET /rest/v1/<tabla>` → `42501` en las 21; sondas (norma C, parámetros inválidos) de las 10 funciones con efectos sin sesión → `42501`; conteos sin cambios.
6. **Bootstrap**: `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/bootstrap-admin.mjs --proyecto <ref> --nombre … --email … --empresa …` (sección 2-C). Solo con 0 perfiles; exige el `ref`; no lee `.env.local`; probado contra la demo con una cuenta de prueba (rol, empresa y login real con la contraseña inicial) y borrada.
7. **Backups (condición de entrega)**: comprobar y **documentar aquí** el estado real —plan del proyecto, «Scheduled backups» activos con su retención, PITR sí/no y el primer backup registrado (Dashboard → Database → Backups)—. **Producción sin backup confirmado no se entrega**; en plan Free no hay backups.

## 6. Fase 3 — Railway producción (pendiente de la PAUSA)

- Servicio **`timerx-prod`** desde el mismo repo/rama (o `produccion`, según la decisión 11). Variables **propias**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (del proyecto **nuevo**), `CRON_SECRET` **nuevo** (32 bytes aleatorios; no reutilizar el de la demo), `MODO_EMAIL=log`, `APP_URL` = dominio de producción. Las `NEXT_PUBLIC_*` se compilan en build: fijarlas **antes** del primer deploy.
- **Cron gemelo** `timerx-prod-cron-recordatorios`: imagen `curlimages/curl:latest`, `cronSchedule` `0 8 * * *`, `startCommand` `curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" "$TARGET_URL"`, variables `CRON_SECRET` (el mismo del servicio prod) y `TARGET_URL` = `https://<dominio-prod>/api/cron/recordatorios`.
- Dominio: subdominio Railway salvo dominio propio (DNS + `site_url` de Auth).
- **La demo y su cron quedan EXACTAMENTE como están**: comprobar al terminar que `timerx` y `timerx-cron-recordatorios` siguen en verde y que sus variables no cambiaron.

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
