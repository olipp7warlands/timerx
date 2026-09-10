# Runbook — Despliegue a producción real

> **Decisión de proyecto cerrada, resto pendiente de ejecución.** Escrito como parte del inventario previo a F6. La decisión de la sección siguiente ya está confirmada por el usuario; el resto de los pasos no se ha ejecutado todavía — sigue siendo Bloque B (producción real), fuera de F6 Bloque A.

## Decisión cerrada: proyecto Supabase/Railway nuevo, separado de la demo

**Confirmado por el usuario: producción real usa un proyecto Supabase nuevo** (no el de la demo, limpiado de datos). Razones que motivaron la recomendación, mantenidas por escrito:
- La demo (`https://timerx-production.up.railway.app`) sigue siendo la herramienta comercial/de presentación — necesita seguir mostrando el escenario de Wowinx/Málaga CF SAD/Legal Norte con datos coherentes indefinidamente, no solo hasta que exista producción real.
- Mezclar datos reales de nómina/refacturación de un cliente real con un proyecto que también sirve demos a terceros es un riesgo operativo innecesario (un clic en el sitio equivocado durante una demo comercial no debe poder tocar datos reales, y viceversa).
- Las credenciales de servicio (`SUPABASE_SERVICE_ROLE_KEY`) de un proyecto de producción real no deberían compartirse con el entorno que además usa el equipo comercial/de producto para enseñar la app.

El resto de este runbook asume proyecto nuevo — los pasos 1-2 son creación desde cero, no limpieza de un proyecto existente.

## 0. Prerrequisitos

- [x] Decisión de proyecto Supabase/Railway nuevo cerrada con el usuario.
- [ ] Dominio propio disponible para producción (no `*.up.railway.app`).
- [x] Decisiones de F6 sobre recordatorios cerradas (Bloque A construido y desplegado: cron + botón manual, `MODO_EMAIL='log'` por defecto — cuenta/dominio Resend reales siguen sin confirmar, ver tabla final).
- [ ] Datos reales del cliente: empresas reales, categorías/subcategorías reales, tarifas reales, lista real de empleados con sus emails — nada de esto existe todavía como artefacto reutilizable, hay que recopilarlo antes de sembrar el proyecto nuevo.

## 1. Proyecto Supabase nuevo

- [ ] Crear proyecto Supabase limpio.
- [ ] Aplicar migraciones **001 a 012 en orden** desde `supabase/migrations/` (`supabase db push` contra el proyecto nuevo, tras `supabase link`).
- [ ] **NO ejecutar `supabase/seed_datos.sql` tal cual** — mezcla datos de catálogo reutilizables (estructura de tarifas, ejemplo de asignaciones) con datos 100% ficticios de la demo (empresas Wowinx/Málaga CF SAD/Legal Norte, imputaciones, ausencias, las 3 líneas `enviada` de F5). Nada de `seed_datos.sql` debe llegar a producción sin reescribirse con datos reales.
- [ ] Sembrar solo lo que sea catálogo real y estable: empresas reales del cliente, categorías/subcategorías reales (`categoria`/`subcategoria`), festivos reales del calendario laboral real, `ajuste` con los valores reales (`jornada_horas`, `tope_horas_dia`, etc. — revisar si los defaults de 002 sirven o hay que ajustarlos al cliente real).
- [ ] Confirmar `RLS` activo en todas las tablas (ya lo está por las migraciones; verificar con una consulta de sesión anónima que da 0 filas, mismo patrón usado en las verificaciones de F3).

## 2. Usuarios reales

- [ ] **Cero usuarios por seed script** (`scripts/seed-usuarios.mjs` es solo para desarrollo/demo — no ejecutar contra producción).
- [ ] Alta exclusivamente por invitación real (`inviteUserByEmail`, sección Usuarios del panel), uno a uno, con el email real de cada persona.
- [ ] **Sin contraseña compartida.** `scripts/set-passwords.mjs` (contraseña `Horas2026!`) es solo para la demo — cada usuario real define su propia contraseña al aceptar la invitación, con reset propio vía el flujo estándar de Supabase Auth.

## 3. Railway

- [ ] Servicio nuevo (o al menos un `environment` de producción real separado, si se decide compartir proyecto Railway — a decidir junto con la pregunta de la sección 0).
- [ ] Variables (`railway variable set`, nunca en texto plano en el repo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — todas del proyecto Supabase **nuevo**, nunca reutilizar las de la demo. `RESEND_API_KEY` si F6 ya está construido y decidido.
- [ ] `railway domain` con dominio propio del cliente/producto, no el genérico `*.up.railway.app` de la demo — requiere configurar DNS.
- [ ] Redeploy tras fijar las `NEXT_PUBLIC_*` (se compilan en build time, no runtime — mismo aviso que en F3.5).
- [ ] `poweredByHeader: false` ya está en `next.config.ts`, no requiere acción.

## 4. Supabase Auth

- [ ] `site_url` = dominio real de producción (no el de Railway demo ni `localhost`).
- [ ] `additional_redirect_urls`: revisar si conviene mantener las de desarrollo local para poder seguir depurando contra este proyecto, o dejarlo estricto solo al dominio real.
- [ ] Aplicar vía `supabase/config.toml` + `supabase config push`, replicando el patrón ya usado en F3.5 (archivo deliberadamente mínimo, solo las 2 claves de `[auth]`, `config diff` antes de pushear para no tocar nada más).

## 5. Verificaciones post-deploy (mismo estándar que F3.5)

- [ ] `/debug`, `/debug/movil`, `/debug/movil-admin` → 404 en el dominio real.
- [ ] Login real de al menos un usuario invitado, sesión establecida, datos reales cargando.
- [ ] `/admin` gated correctamente por rol.
- [ ] Cabeceras revisadas (sin `X-Powered-By`, nada inesperado).
- [ ] `grep` del valor de `SUPABASE_SERVICE_ROLE_KEY` sobre un build local con las mismas variables → cero coincidencias en `.next` (mismo control que F3.5).

## Todo lo que hoy es "demo" y no debe llegar a producción tal cual

Lista de repaso explícito antes de dar F6/producción por cerrada:

| Elemento | Dónde vive | Por qué no vale para producción |
|---|---|---|
| Contraseña compartida `Horas2026!` | `scripts/set-passwords.mjs` | Credencial única compartida entre 11 cuentas — solo aceptable para poder enseñar la demo desde un móvil sin depender de magic links. |
| Seed ficticio completo | `scripts/seed-usuarios.mjs`, `supabase/seed.sql`, `supabase/seed_datos.sql` | Empresas (Wowinx SL, Málaga CF SAD, Legal Norte), proyectos (Ximeras, Triatix...), imputaciones y ausencias son todas de ejemplo. |
| 3 líneas `enviada` de F5 | `supabase/seed_datos.sql` §8 (Leo Silva, Sara Martín) | Añadidas explícitamente para que la bandeja de aprobación se enseñe poblada en la demo. |
| Dominio `timerx-production.up.railway.app` | Railway (F3.5) | Dominio genérico de demo, no de marca/cliente. |
| `olcasan08@gmail.com` (Oliver Pérez) como empleado invitado | Seed real vía invitación (post-F3.5) | Es la vía de acceso del propietario del proyecto a la demo desde el móvil, no un usuario real del cliente. |
| 12h sin tarifa "a propósito" en Wowinx, septiembre | Datos reales insertados durante F3/F4 para poder enseñar el bloqueo de cierre | Escenario deliberadamente roto para demostrar `cerrar_periodo()`. |
| `additional_redirect_urls` con `localhost`/`127.0.0.1` | `supabase/config.toml` | Solo tiene sentido si producción sigue siendo el mismo proyecto que se usa para desarrollar localmente — revisar según la decisión de la sección 0. |
