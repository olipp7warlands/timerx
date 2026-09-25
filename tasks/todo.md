# LOTE v1.4 (2026-09-25) — departamento en ficha + importadores de catálogo (Empresas, Proyectos, Categorías)

> main → demo → commit listo para promoción. Pack de producción intacto. Línea base demo: conteos en `base14_conteos.txt` + huella `snap2` (scratchpad).

## Hallazgos de lectura (antes de tocar código)
- **Punto 2 (jornada)**: el trigger `empresa_jornada_defecto` (019) YA siembra 7 filas al insertar una empresa (UI, importador, cualquier vía) → **no hay 029 por la condición del enunciado**. Medido: empresa creada con sesión de AG → 7 filas. PERO su valor sale de `ajuste.jornada_horas` (8) → **8/8/8/8/8/0/0**, no el estándar 8/8/8/8/**5,5**/0/0. Evidencia en PRODUCCIÓN: «Oli FC» (creada por UI tras el seed) tiene 8 el viernes; las 3 sembradas, 5,5. Decisión pendiente del usuario (ver informe).
- **Punto 1 (departamento)**: NO reproducible como «falta el campo»: la ficha ya tiene el select (4 opciones), carga y guarda (verificado en la UI real: Enrique «sin dep» → Jurídico; Leo 3B3 → Diseño; revertidos).

## Pasos
- [x] 1. Paridad ficha↔inline (diff de campos, `key` por usuario) y tabla de paridad.
- [x] 3a/b/c. Importadores empresas/proyectos/categorías + plantillas + exports + cards por sección (solo AG).
- [x] Verificación: paridad con capturas; empresa nueva (UI e importada) con jornada; round-trip por entidad; import real 2-3 filas con una errónea + reversión con conteos; tipología heredada vs explícita en el mapa AUTO; plantillas abiertas; huella; build/lint.
- [x] PLAN.md / lessons / commit / demo en verde / COMMIT LISTO PARA PROMOCIÓN.

## Revisión (v1.4)
- Sin migraciones nuevas (punto 2: la 019 ya siembra la jornada; discrepancia 8 vs 5,5 documentada y a decidir). 3 importadores + 3 exports + paridad ficha↔inline. Verificado con sesión real de Cristian; conteos y huellas idénticos; build/lint sin nuevos.

---

# LOTE v1.2 + v1.3 combinado (2026-09-25) — main → demo → verificación → commit listo para promoción

> Flujo: trabajo en `main` (demo, autodeploy). NO se toca producción ni el pack de revisión de producción. Todo llega allí en la próxima promoción (runbook §12).
> Línea base medida hoy (la demo ha evolvido desde el 19/09: 141 imputaciones, 8 proyectos, 5 categorías, 5 tickets): conteos en `base_conteos.txt` (scratchpad), huella `snap2` cruda `c77ae3a7` / **canónica `016e5c34`** (la `6c50f784` del 19/09 correspondía a otros datos).

## Decisiones (tomadas leyendo el código; todas reversibles)
- ENTORNO.md: archivos LOCALES excluidos en `.git/info/exclude` (compartido por los worktrees): no viajan a `produccion` en una promoción ni disparan despliegue; no ensucian ningún árbol.
- **027** (tickets): `ticket_lectura` (PK ticket_id+perfil_id, RLS solo filas propias) + `ticket.estado_cambiado_en/_por` (trigger `BEFORE UPDATE OF estado`) para detectar cambios de estado + RPC `ticket_marcar_visto` (usa la hora del SERVIDOR, no la del cliente) + RPC `tickets_con_novedad()` (invoker, solo tickets propios). Novedad = comentario de otra persona O cambio de estado hecho por otra persona, posterior a `ultimo_visto`.
- **028** (guarda): trigger `BEFORE UPDATE OF rol ON perfil` con invariante «siempre queda >= 1 admin_grupo activo» (vale para TODOS los llamadores, service_role incluido; el mensaje es el del enunciado). La ficha/inline dejan de ofrecer el rol al único admin.
- Contexto React `SoporteNovedadProvider` en `EmpleadoApp` y `AdminApp` (no un store de módulo: no filtra estado entre usuarios) — un solo recuento al cargar, sin tiempo real.
- Punto también sobre el botón del avatar (única forma de descubrirlo en móvil empleado, que no tiene pestaña Soporte).
- Tareas (F): función pura única `repartirTareas` (`src/lib/horas/tareas.ts`) — la usan hook del empleado (composer, precargado, wizard) y la imputación directa del admin.

## Pasos (marcar al cerrar)
- [x] 0. ENTORNO.md en los dos worktrees + salida de `git worktree list` (enlazados desde el runbook §12).
- [x] Baseline: conteos + snap2 (scripts en el scratchpad de la sesión).
- [x] 1. Migración 027 → `db push` → commit+push INMEDIATO de la migración; sondas: RLS propia, anon, mismo-perfil, hostil.
- [x] 2. Migración 028 → `db push` → commit+push INMEDIATO; sonda directa (transacción abortada con impersonación) + camino positivo con sesión real.
- [x] 3. C: hook/contexto de novedad, punto en menú (4 shells) + sidebar/pestaña + fila de lista; `marcarVisto` al abrir.
- [x] 4. D: «Registrar coste» + mini-histórico (INSERT versionado, 23505 → error claro).
- [x] 5. E: verificar «Editar datos» en ficha propia; UI del único admin; mensajes.
- [x] 6. A: pestañas `?vista=` (Usuarios/Importar/Costes), formulario colapsable + hand-off `?invitar=`.
- [x] 7. B: inventario de textos pasivos + estados vacíos operativos (tabla antes/después con capturas).
- [x] 8. F: `repartirTareas` + hook + `SelectorTarea` (web) + «Otras tareas ›» (hoja móvil) + imputación directa.
- [x] 9. Verificación única (ver enunciado) + build/lint sin nuevos + conteos + huella canónica.
- [x] 10. PLAN.md / runbook (enlaces ENTORNO) / lessons; commit en main, demo en verde, COMMIT LISTO PARA PROMOCIÓN.


## Revisión (v1.2 + v1.3)
- 027 y 028 aplicadas a la demo y pusheadas en el acto (`6795941`, `655475b`); el resto en un solo commit de código. Producción NO tocada: pendientes de promoción **027 y 028** + el código.
- Verificado con sesiones reales (Cristian, Leo, Marina), ambos temas y móvil (iframe 390 px); conteos + huellas (`c77ae3a7` cruda / `016e5c34` canónica) idénticos; build limpio; lint 78 (≤ 79 preexistentes).
- Abierto/decisiones a confirmar: (1) E no tenía bloqueo visible en la ficha propia (ver PLAN.md); (2) punto también sobre el avatar; (3) la guarda 028 vale también para service_role.

---

# TODO — Correctivo de verificación (Soporte/Leo en producción) → Lote 4 (migración 020)

> Combinado 5+2 (018, 019) aceptado por el usuario el 2026-09-19: cerrado y desplegado, detalle en PLAN.md.
> **Cifras canónicas de regresión desde ahora (jornada viva 8 h)**: requeridas sept 176 · Andrés 172 / 160 / +12 · FTE 1,0750 · Ximeras 1,9925 · foto SHA-256 ampliada (73 claves, `snap2.mjs`) `a97033ad…`. Las de jornada 7 (154 / 172-140-+32 / 1,2286 / 2,2772) quedan como histórico. El "176,0" del caso 8/8/8/8/5,5 era errata de la spec: 166,0 correcto.
> Prompt original del Lote 4 recuperado de la transcripción de la sesión anterior (ede907e7, línea 1308); esta sesión empezó sin él.

## Norma de sesión (corregida por el usuario)
- **Toda verificación arranca con LOGIN EXPLÍCITO de una identidad de la plantilla (script: magic link → cookie, o `comoUsuario`). NUNCA se usa la sesión que traiga el navegador (Haizea u otra), ni siquiera "sin sobrescribirla".** Al terminar, borrar las cookies `sb-*`.
- `olcasan08@gmail.com` off-limits.

## 0. Cierre de papeles
- [x] 0a. PLAN.md: cifras canónicas de jornada 8 como regresión + norma de sesión.
- [x] 0b. "Haiba": comprobar en `perfil` y `auth.users` (13/13) → respuesta (errata de Haizea si no existe cuenta distinta).

## 1. CORRECTIVO OBLIGATORIO (antes del Lote 4) — lado empleado del ciclo de Soporte EN PRODUCCIÓN
- [x] 1a. Foto base: conteos de las 21 tablas + `auth.users`, siguiente ref de ticket.
- [x] 1b. Login explícito de **Leo** (magic link con `redirectTo` = dominio de Railway → cookie) en `timerx-production.up.railway.app`.
- [x] 1c. Leo: crea ticket (UI desplegada) → lo ve en su lista → admin (Cristian, script con sesión real) responde → Leo ve respuesta/estado → Leo comenta → Cristian resuelve → Leo lo ve resuelto.
- [x] 1d. Revertir: borrar ticket+comentarios de prueba, `ticket_ref_resincronizar()`, conteos idénticos a 1a, siguiente ref = T-018, T-014..T-017 intactos. Borrar cookies `sb-*`.
- [x] 1e. Documentar en PLAN.md.

## 2. LOTE 4 (migración 020) — se arranca solo al cerrar el punto 1
- [x] 2.1 Tipologías: `empresa.area_id`, `proyecto.area_id` (uuid null → mapa_area); selector "Heredar de la empresa (X)" (copia) / áreas / sin tipología; select de área en alta y Editar de empresa; seed Wowinx→Tecnología, Málaga→Deportes, Legal Norte→NULL, proyectos heredan salvo Interno y Asesoría intragrupo→NULL.
- [x] 2.2 Mapa semi-automático (composición en lectura en `useMapa`): proyectos ACTIVOS con área bajo su área, tag AUTO, tras los manuales, dedupe por nombre (manual manda).
- [x] 2.3 Color por área en roscos: `colorProyecto/colorEmpresa` únicos (`src/lib/mapa/colores.ts`), degradado por índice, fallback grises; aplicar a todos los quesos (único componente `Donut.tsx`); quesos por categoría con colores de categoría; leyendas nombre+%.
- [x] 2.4 Edición inline en Usuarios (Departamento/Rol/Categoría; mismas mutaciones de `useUsuarios.actualizar`; rol con `confirmar()`; empresa/nombre no; guard de fila; ámbito admin_empresa).
- [x] 2.5 Alta rápida de categoría en el formulario de invitación (misma mutación `crearCategoria`, global; se autoselecciona; "Creada ✓").
- [x] 2.6a `empresa.activa` deja de ser decorativa: selectores filtran activa=true (documentar cuáles) + listado atenuado con badge "Inactiva".
- [x] 2.6b Hero empleado sin imputaciones: balance atenuado + "Aún sin imputaciones este mes" (solo presentación).
- [x] 2.6c PLAN.md: decisión de alcance cerrada — bandeja de aprobación y fichas NO en admin móvil v1; retirar "candidatas".
- [x] 2.a Micro-aviso en el resumen del día de admin_empresa ("Las horas de tu gente en proyectos de otras empresas no se incluyen") + semántica documentada en PLAN.md.
- [x] 2.b Bug `toISOString()`: helper único de fechas, corregir `useFichaUsuario` YA y barrer el repo — citar CADA uso con veredicto.
- [x] 2.c Lint: los 5 nuevos a cero (79 preexistentes no son de este lote; medir línea base antes).
- [x] 2.d Seed del ticket con día de semana: ajustar al día real que calcula la app, no al texto del mock.

## 3. Verificación y cierre del Lote 4
- [x] Regresión de cifras: cruda `a97033ad…` idéntica antes/después de la 020; tras las pruebas de UI la cruda es `d8d7dbcc…` con los mismos datos (orden de empates) y la CANÓNICA `6c50f784` no cambia; conteos idénticos; RLS de las columnas nuevas con intentos reales de Marina.
- [x] Ciclo del enunciado en LOCAL con login explícito por identidad (Cristian, Andrés, Marina, Cosme): heredar→AUTO en Andrés→homónimo lo desplaza→cambiar tipología recoloca y recolorea; roscos claro/oscuro; inline; alta rápida; selectores sin inactivas (con control positivo); hero sin horas (escritorio y móvil).
- [x] Capturas contra el mock; build; commit + push; redeploy; retest en producción (login explícito por identidad).

## Hallazgos abiertos (tareas separadas, NO tocadas)
- [x] **SEGURIDAD** (cerrado en la 021): `perfil_update_admin` permite a un admin_empresa cambiar `rol` (incluido el suyo a `admin_grupo`) por API directa. Reproducido y revertido. Requiere guarda + retest de 3 identidades. Pendiente de confirmación del usuario.
- [x] (cerrado en la 021) `resumen_dia`/`resumen_mes`: `order by` sin desempate (huella cruda frágil). Regresión con huella canónica `6c50f784`.

## Revisión
- Lote 4 completo en local; pendiente: commit/push, redeploy y retest en producción con login explícito (ver PLAN.md).

---

# MIGRACIÓN 021 — guarda de rol/empresa en `perfil` + desempate de `resumen_dia/mes` (decisión del usuario, 2026-09-19)

## Decisiones de diseño
- Guarda = trigger `BEFORE UPDATE OF rol, empresa_id ON perfil` (RLS no compara OLD/NEW). Compara con `IS DISTINCT FROM`: un UPDATE que reenvía los mismos valores (la ficha lo hacía) NO se bloquea.
- Ambas transiciones (rol y empresa) reservadas a `admin_grupo`. admin_empresa sigue editando departamento y categoría.
- service_role / conexiones directas (migraciones, scripts, importadores) EXENTOS por identidad de rol de BD (`current_user in ('authenticated','anon')` es lo único que se guarda): `auth.uid()` es null en service_role, así que `es_admin_grupo()` daría null y los bloquearía. Se comprueba con caso explícito.
- Ride-along comentado aparte en la misma 021: `resumen_dia`/`resumen_mes` con clave única al final del ORDER BY (nombre, id).
- UI: la ficha deja de renderizar los selects de empresa y rol a no-admin_grupo (texto plano) y no envía esos campos; inline ya no ofrecía rol/empresa a admin_empresa (verificar).

## Pasos
- [x] Foto base: conteos + huella ampliada (cruda `d8d7dbcc`, canónica `6c50f784`), `escalada_ANTES` (A/B/C de Marina funcionan; D ya lo frena RLS).
- [x] Escribir 021 y aplicarla (`db push`) → commit+push INMEDIATO.
- [x] `escalada_DESPUES`: A/B/C rechazadas con el RAISE; E/F/F2 (Marina) y I/J/K (Cristian) y L (service_role) intactos.
- [x] Importador de usuarios (ruta real con cookie de Cristian) y alta manual intactos; ficha como admin_grupo cambia empresa.
- [x] UI (ficha + comentarios/textos) + build + lint sin regresión.
- [x] Huella canónica `6c50f784` idéntica tras la 021; nueva cruda anotada como vigente; conteos idénticos.
- [x] Navegador, login explícito de Cristian / Marina / Andrés: local y PRODUCCIÓN (commit+push+redeploy).
- [x] PLAN.md + tasks/lessons.md; cerrar los dos hallazgos abiertos de arriba.

## Revisión (021)
- Guarda viva y verificada: exploit de Marina ANTES (funciona) / DESPUÉS (RAISE 42501), sin sobre-bloqueo (dep/cat de su gente, reenvío sin cambios), Cristian y service_role intactos, importador de usuarios y cambio de empresa desde la ficha (admin_grupo) intactos. Huella canónica `6c50f784` idéntica; cruda estable en `fab8021d`. Local + producción con Cristian / Marina / Andrés.
- Los dos "Hallazgos abiertos" del Lote 4 quedan CERRADOS (021).
- **Hallazgo nuevo abierto (tarea separada, sin tocar)**: `invitarUsuario` deja a un admin_empresa invitar con `rol = 'admin_empresa'` (par en su empresa); la UI no lo ofrece. Ver PLAN.md, sección 021.

---

# SUPERFICIE service_role — regla de roles en server actions (decisión del usuario, 2026-09-19)

## Regla
- La asignación de roles admin_* es territorio de admin_grupo: un admin_empresa solo puede crear cuentas con rol `empleado` o `responsable_proyecto` (lista blanca, no lista negra).
- Mini-auditoría de TODA puerta service_role: ámbito de empresa Y límites de rol replicados en TS; veredicto citado (ya-correcta / corregida).
- Hallazgo de la auditoría (además del pedido): `restablecerPasswordEmpleado` no limita por rol del objetivo → admin_empresa puede reiniciar la contraseña de un admin_* de su empresa (toma de cuenta; con un admin_grupo empleado en su empresa = escalada). Regla: admin_empresa solo restablece a cuentas no-admin.

## Pasos
- [x] Auditoría en lectura (citas en PLAN.md).
- [x] ANTES con sesión real de Marina (UI desplegada en local, cliente manipulado): invitar cuenta con rol admin_empresa (debe funcionar hoy) y restablecer contraseña de una cuenta de prueba admin_grupo de su empresa (debe funcionar hoy).
- [x] Fix en servidor (`invitarUsuario`, `restablecerPasswordEmpleado`) con helper único de permisos.
- [x] DESPUÉS: mismos intentos rechazados con mensaje claro; sin sobre-bloqueo (Marina invita empleado/responsable de SU empresa; sigue rechazada fuera de su empresa; Cristian invita cualquier rol y restablece a cualquiera).
- [x] UI alineada: la ficha no ofrece «Restablecer contraseña» a admin_empresa sobre cuentas admin_*.
- [x] Cuentas de prueba borradas (auth + perfil); conteos idénticos; canónica `6c50f784`; build/lint sin nuevos; commit+push+redeploy; retest del par clave en producción.
- [x] PLAN.md (tabla de veredictos con citas) + lessons.

## Revisión (superficie service_role)
- Corregidas 2 puertas: `invitarUsuario` (lista blanca de roles no-admin para admin_empresa) y `restablecerPasswordEmpleado` (admin_empresa no restablece cuentas admin_*; hallazgo de la auditoría). El resto (recordatorios manual/empleado, cron, importadores, plantillas/exports) ya-correctas, con cita en PLAN.md.
- ANTES/DESPUÉS con sesión real de Marina + sin sobre-bloqueo + Cristian intacto; local y producción. Conteos idénticos, `6c50f784` intacta, build/lint sin nuevos.
- Observación abierta (no service_role, sin tocar): `perfil_update_admin` deja a un admin_empresa editar columnas no estructurales (`activo`, `nombre`, `max_horas_dia`…) de los perfiles de su empresa, también de un admin_grupo que viva en ella.

---

# MIGRACIÓN 022 — perfil_update_admin (decisión del usuario, 2026-09-19) + MODELO DE PERMISOS COMPLETO

## Principio
Un admin_empresa administra los perfiles NO-admin de su empresa; las cuentas admin_* solo las administra admin_grupo, en todos los campos. Su propio perfil queda como está (sin rol/empresa por la 021).

## Pasos
- [x] ANTES con sesión real de Marina: cambia nombre/activo/max_horas_dia/departamento del admin_grupo y del admin_empresa par de su empresa (PERMITIDO).
- [x] Migración 022 (policy `perfil_update_admin` con lista blanca + propio); `db push` → commit+push inmediato (`bbfe554`).
- [x] DESPUÉS: 6 intentos BLOQUEADOS (0 filas); sin sobre-bloqueo (Enrique, propio, 021 intacta); Cristian y service_role intactos.
- [x] UI vía `permisos.ts` (`puedeAdministrarPerfil`): ficha e inline; `AdminInfo.id`; 0 filas = error en `useUsuarios`.
- [x] Local + PRODUCCIÓN con login explícito (Marina, Cristian; Andrés por matriz). Commit `b961c7d`.
- [x] Cuentas de prueba borradas; conteos idénticos; canónica `6c50f784`, cruda `fab8021d`; build/lint sin nuevos.
- [x] MODELO DE PERMISOS COMPLETO en PLAN.md (tabla rol × operación con capa y cita; columna V de verificación).

## Revisión (022)
- Familia cerrada: rol/empresa (021) + contraseñas y alta (server actions) + resto de columnas de perfil (022).
- **Hallazgos ABIERTOS que requieren decisión (ver PLAN.md, «Hallazgos de la construcción de la matriz»)**: **A** (crítico, verificado) `cerrar_periodo` e `imputar_directo` no frenan a `anon` (guarda null + EXECUTE por defecto); **B** (crítico si el registro sigue abierto: `disable_signup=false` + `handle_new_user` confía en `rol` del cliente); C–J menores.
- Descuido propio corregido: una sonda de `cerrar_periodo` como AG escribió un periodo de prueba (borrado; periodo 6, imputaciones 139).

---

# MIGRACIÓN 023 — superficie de funciones + registro público + handle_new_user (decisión del usuario, urgente)

## Alcance
A) Inventario de TODAS las funciones (51), REVOKE EXECUTE a public/anon (¿alguna necesita anon? ninguna), GRANT explícito, guardas `auth.uid() is null` en toda función con efectos, tabla en la migración. B) Signup desactivado en la config de Auth (+ runbook), `handle_new_user` con rol siempre `empleado` y auditoría de los demás campos. C) Norma de sondas (lessons + PLAN).

## Pasos
- [x] Catálogo vivo (migración temporal de solo lectura) + definiciones vivas de las funciones con efectos.
- [x] ANTES: sondas anon (14/18 pasan EXECUTE); INSERT con metadatos maliciosos → perfil `admin_grupo`.
- [x] B(1) Signup: `enable_signup=false`; diff de `config push` previsualizado (habría recortado MFA/confirmación) → valores remotos fijados; `disable_signup:true`, signUp → 422.
- [x] Migración 023 (grants + guardas + handle_new_user + autocomprobación) aplicada → commit+push inmediato (`a764fd8`).
- [x] `altaUsuario` y `seed-usuarios.mjs` asignan el rol después.
- [x] DESPUÉS: anon 18/18 EXECUTE DENEGADO; guardas con `authenticated` sin uid (sonda SQL); trigger → `empleado`.
- [x] Flujos legítimos (26 comprobaciones, norma C) + 7 triggers + UI (invitar 4 roles, importador) + exports + páginas.
- [x] Producción con la anon key del bundle; Cristian/Marina/Andrés; cuentas de prueba borradas; conteos idénticos; `6c50f784`/`fab8021d`; build/lint.
- [x] PLAN.md (sección 023, matriz, norma C, propuestas C–L), runbook (§4 y §5), lessons 11–13.

## Revisión (023)
- **A y B CERRADOS.** Quedan C–L con propuesta una-línea en PLAN.md (arreglar-ya / va-al-runbook / aceptar-documentado) para decidirlos en una pasada.
- Nuevos K (privilegios de tabla de `anon`, solo RLS) y L (ACL por defecto de `supabase_admin`) surgidos de esta auditoría.


---

# MIGRACIÓN 024 — decisiones C–L del usuario (2026-09-19) + CONGELACIÓN DE SEGURIDAD

## Veredictos decididos
C imputar_directo: AE solo si empleado Y proyecto son de SU empresa (guarda RPC + UI filtra) · D 0 filas = error visible (solo UI) + barrido citado · E departamento sin `empresa_id` → escritura solo AG · F aceptar-documentado · G aceptar-documentado · H trigger `cerrada` inmutable (UPDATE/DELETE) + column grants de `imputacion` · I `activo` bloquea el acceso en la app («Cuenta desactivada», sin migración) + «Reactivar» · J categoría aceptar-documentado; `perfil_insert_admin` con lista blanca de roles · K REVOKE ALL a anon/public en TODAS las tablas/vistas/secuencias + GRANT explícito según el modelo · L norma de proyecto «ninguna función desde el panel» + verificación periódica en el runbook.

## Pasos
- [x] Catálogo vivo de tablas/vistas/secuencias/policies/triggers (migración temporal de solo lectura).
- [x] ANTES con datos de prueba (norma de sondas): C (Marina/Cristian), E, H, J, K.
- [x] Migración 024 (SQL) → `db push` → commit+push inmediato.
- [x] App: C (selectores + `puedeImputarDirecto`), D (0 filas = error + barrido), E (ocultar «Crear departamento» al AE), I (Cuenta desactivada + Reactivar + server actions/rutas), H (flujos del empleado intactos).
- [x] DESPUÉS + sin sobre-bloqueo; UI real (Marina/Cristian/Andrés); build/lint; producción.
- [x] PLAN.md (sección 024, matriz, tabla C–L, norma L, congelación) + runbook + lessons; backlog documentado.

## Revisión (024)
- **C–L resueltos**: C, D, E, H, I, J-insert, K arreglados; F, G, J-categoría aceptado-documentado (`docs/seguridad-backlog.md`); L norma de proyecto + verificación periódica del runbook. Tabla con veredicto y cita en PLAN.md («Migración 024 + app»).
- Local + PRODUCCIÓN con Marina, Cristian y Andrés (incluido el compositor real del empleado con las nuevas columnas concedidas); anon con la anon key del bundle; huellas `6c50f784`/`fab8021d`; conteos idénticos; build/lint sin nuevos.
- **CONGELACIÓN DE SEGURIDAD en vigor**: nuevos hallazgos menores → `docs/seguridad-backlog.md`; solo críticos demostrables abren migración.
- Backlog abierto documentado: I-residual (ban en Auth al desactivar), L (mitigado por proceso).

---

# RUNBOOK DE PRODUCCIÓN — ejecución por fases (prompt del usuario, 2026-09-19)

- [x] **Reconciliar** `docs/runbook-produccion.md` con el prompt (este manda): reescrito; discrepancias en su §1.
- [x] **Paso 0 — I-residual**: server action `desactivarUsuario`/`reactivarUsuario` (ban + permisos.ts), migración 025 (pre-request), verificación con JWT vigente (local y demo desplegada), revertido, huella `6c50f784` intacta, commit+push+redeploy demo.
- [x] **Fase 1 — seed** `supabase/seed-produccion.sql` con veredicto por sección; validado en copia emulada de proyecto nuevo; bootstrap `scripts/bootstrap-admin.mjs` probado.
- [x] **PAUSA** (respuestas a–m recibidas 2026-09-19). Quedan SIN rellenar por el usuario: los 3 CIF, nombre+email del primer admin_grupo y confirmar plan Pro (ver «Bloqueado» abajo).
- [x] Fase 2 (parte técnica) — proyecto `horasgrupo-prod` (ref `duksjzgoipwwrjvvgzon`, París); worktree `../TimerX-prod` (rama `produccion`) enlazado solo a él; `db push` de las 24 migraciones (dry-run = 24, historial 24/24 sin sonda residual); censo idéntico (21 tablas, 4 vistas, 1 secuencia, 53 funciones/8 trigger, 7 triggers, 43 policies, 46 índices, 20 PK, 35 FK, 16 CHECK, 12 UNIQUE, 7 enums, RLS 21/21, pre-request fijado); catálogo: 0 funciones (salvo el pre-request) y 0 tablas/vistas/secuencias para `anon`; con la anon key nueva: 25 tablas+vistas → 42501, 18 RPC → 42501, escrituras → 42501, conteos intactos; `config push` con diff previo (solo site_url, redirects, enable_signup) → `disable_signup:true`, signUp real → 422 `signup_disabled`, 0 usuarios; backups: físico COMPLETED, `walg_enabled:true`, PITR off (decidido).
- [x] Fase 2 (completa, 2026-09-22) — CIF: decisión del usuario de sembrar `cif = null` en las 3 empresas (se fijan después desde la ficha); validado en transacción abortada sobre producción; aplicado con `db push --include-seed`; conteos verificados. Bootstrap del admin (Oliver Perez Parada, Wowinx SL) con la contraseña que dio el usuario. Plan Pro confirmado por el usuario en Billing.
- [x] Fase 3 (parte técnica) — Railway `timerx-prod` (rama `produccion`, europe-west4, dominio `timerx-prod-production.up.railway.app`, variables propias, `CRON_SECRET` nuevo, `MODO_EMAIL=log`, `APP_URL`) + cron gemelo `timerx-prod-cron-recordatorios` (`0 8 * * *`); build OK; app apunta solo al Supabase de producción; cron gemelo probado (HTTP 200, EXIT 0). Demo intacta (ver revisión).
- [x] Fase 4 (2026-09-22) — ciclo mínimo completo con cuentas de prueba (asignar/imputar/enviar/aprobar/ficha/mapa/ticket T-001/resolver), revertido por completo; spot-checks de permisos con sesiones reales (guarda de rol, RLS admin_empresa, inmutabilidad de `cerrada` en transacción abortada, desactivar/reactivar con JWT vigente); deep-link/atrás/F5 sin sesión (el móvil no se pudo forzar en este entorno); hallazgos M y N documentados en `docs/seguridad-backlog.md`. Conteos finales = seed + 1 perfil (el admin real).
- [x] Fase 5 (2026-09-22) — runbook → «ejecutado»; `docs/dia-1.md` escrito; PLAN.md «Producción — entrega».

## Decisiones cerradas 2026-09-21/22 (mensajes del usuario)
- [x] **Cron de la demo**: aplicado el mismo arreglo que al gemelo (`sh -c 'curl -sS --fail-with-body --retry 3 --retry-delay 10 --retry-all-errors …'`), fuera de la congelación (robustez operativa). Probado con disparo real (20:31 UTC: 1.er intento falla, reintento OK, 200); horario restaurado a `0 8 * * *`. Config idéntica al gemelo salvo región/vars.
- [x] **CIF**: no van en el seed; se fijan desde la ficha (decisión 2026-09-22). Ver Fase 2.
- [x] **Primer admin_grupo y Plan Pro**: confirmados por el usuario 2026-09-22. Ver Fase 2.
- [ ] **dia-1.md (paso del usuario)**: rotar la contraseña de la BD de `horasgrupo-prod` desde el panel de Supabase tras la entrega (la actual está en su gestor). Ya en la checklist de `docs/dia-1.md`.
- [ ] **Backlog sin urgencia**: M (asignación cross-empresa por admin_empresa) y N (`/auth/callback` origen mal calculado detrás de Railway, también en la demo) — `docs/seguridad-backlog.md`.
- [ ] **Pendiente del usuario**: probar el flujo de «cambiar contraseña» y un deep-link/atrás/F5/móvil con su propia sesión ya autenticada (Fase 4 no pudo inyectar una sesión en el navegador: bloqueado por el clasificador de permisos de Claude Code, «materialización de credenciales»).

