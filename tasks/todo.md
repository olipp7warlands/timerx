# LOTE v2.0 (b) — importadores/exports del catálogo, empresas con departamentos, semillas y barrido «tarea» (2026-10-05) — LISTO PARA PROMOCIÓN

> Cierra el modelo Departamento → Especialidad. **La promoción espera a C3** (identificar el perfil nº 7 de producción antes de la 031). En producción: 031 y promoción de la app en secuencia INMEDIATA, sin ventana de horas (D10).

- [x] **Barrido «tarea» → «especialidad»** (detector AST, mismo método que v1.7): 24 apariciones visibles. Tabla: `lib/importadores/categorias.ts` 10 (reescrito entero), `app/debug/ImputacionTester.tsx` 3, `ControlEscritorio.tsx` 1 («Selecciona especialidad»), `ImputarMovil.tsx` 1. Frase revisada, no reemplazo mecánico: «Imputar nueva tarea» → **«Nueva imputación»** (con «Imputar nueva especialidad» sonaba forzado); «¿Qué especialidad?», «Selecciona especialidad». Supervivientes (código/esquema): `subcategoria`, `lib/horas/tareas.ts` y `buscarTarea`/`repartirTareas`/`GrupoTareas`/`SelectorTarea`, el token `'tarea'` del paso de la hoja móvil, ids de API `/api/export/categorias` y `/api/plantillas/categorias`. Detector sobre todas las superficies: **0** en v2.0 (control: 1 en la demo anterior).
- [x] **Importador/export del catálogo** `departamento · especialidad` (un único INSERT, todo-o-nada de Postgres; los departamentos no se crean ahí). Ruptura declarada D8: la plantilla vieja (`categoria`/`tarea`) devuelve un error claro («plantilla ANTERIOR… descarga la plantilla nueva») vía `DefinicionPlantilla.antiguas`. La tarjeta Importar/Exportar vuelve a la UI (dentro de Departamentos). Round-trip: importar 3 filas → export → reimportar el export (solo duplicados).
- [x] **Importador de empresas** con columna `departamentos` (lista separada por «;»; vacía = todos los activos; D9) + export con la columna; compensación si falla el segundo INSERT.
- [x] **Export de usuarios** sin la columna muerta.
- [x] **Semillas** (`seed.sql`, `seed_datos.sql`, `seed-produccion.sql`) al modelo nuevo: 4 departamentos con color + espejo con ids FIJOS + `empresa_departamento` + especialidades; sin categoría de perfil; Sara en Diseño. **Hallazgo**: las migraciones 001-029 no siembran catálogo, así que un proyecto nuevo se encontraba la 031 con el catálogo VACÍO y abortaba → la 031 ahora es un no-op sin departamentos (el archivo cambió DESPUÉS de aplicarse en demo; en demo no cambia nada, en producción correrá ya con esta versión). **Prueba desde cero** (transacción abortada en demo: vaciar todo salvo `ajuste`/`festivo`, re-ejecutar la 031 sobre el catálogo vacío y cada semilla): `seed.sql` y `seed-produccion.sql` crean 4/4/14/12, espejo 1:1 con ids fijos, colores, y el trigger de la 030 sigue vivo (un departamento nuevo nace con su espejo).
- [x] Verificación: round-trip de cada plantilla nueva y error de la vieja 17/17; ciclo de Departamentos (C1/C2/visibilidad) 30/30 con el código final; recorrido con detector 0; tsc/build limpios, lint 78=78; conteos y huella ANCLA (`600be8b5`/`ea31926b`, enmascarada `53553bd7`) intactos.
- [ ] **C3**, fase 4 (promoción): `comprobar-paridad` → backup → 030 (si no está) → 031 + merge `main → produccion` seguidos → `comprobar-paridad`.

---

# LOTE v2.0 (a) — modelo Departamento → Especialidad (2026-10-05) — EN PARADA para revisión

> Plan aprobado en `tasks/plan-v2.0.md` (12 decisiones + C1/C2/C3). Lote (a) = BD + selector + usuarios + sección fusionada (+ colores: movidos aquí porque la 031 renombra departamentos y el color por nombre se habría roto). Lote (b) = importador/export del catálogo, exports restantes, semillas, barrido «tarea».
> **NO está en producción.** Demo: 030 y 031 aplicadas; app en `main`.

- [x] Fase 0: línea base (conteos, ANCLA `b908bdf7`/enmascarada `53553bd7`, conjunto visible por perfil = 15 para los 13 perfiles).
- [x] 030 aditiva (color, `empresa_departamento`, `perfil_departamento`, trigger del espejo) aplicada y verificada (conteos e huellas idénticos).
- [x] **C1** (sonda en transacción abortada + UI): alta/renombre/desactivación/reactivación del departamento crean/renombran/desactivan/reactivan su espejo en la misma transacción; sin tarifa `resolver_tarifa`=NULL y `cerrar_periodo` bloquea nombrando el departamento nuevo; con tarifa 77 → 77, vista valorada 154 €, `cerrar_periodo` cierra.
- [x] **C2** (UI real): tarifa nueva para un departamento nuevo desde Tarifas (88 €/h) → `resolver_tarifa`=88; Excel de refacturación con cabecera «Departamento» y la fila del departamento nuevo (176 €).
- [x] 031 conmutación aplicada en demo (autocomprobación OK): Desarrollo/Legal/Administración y Finanzas/Operaciones, espejo 1:1 NOT NULL UNIQUE, 15 enlaces `empresa_departamento`, Sara → Diseño. ANCLA enmascarada IDÉNTICA (`53553bd7`); normal nueva línea base **cruda `600be8b5` · canónica `ea31926b`** (cambian solo cadenas de nombre de departamento). Conteos: solo `departamento` 3→5.
- [x] Prueba «nadie ve menos»: 13 perfiles, 0 ven menos, 0 ven más (15/15).
- [x] Reversa `supabase/rollback/v2.0_down.sql` ENSAYADA en demo (transacción abortada): restaura nombres, enlaces, colores, Sara, tablas vacías, respaldo eliminado; imputaciones/tarifas/importe valorado idénticos.
- [x] App: sección fusionada (listado con color/empresas/nº, alta con lista predefinida + personalizado + empresas, edición con color/empresas, especialidades dentro), selector sin «Otras tareas…» (regla única `repartirTareas`: empresa o conjunto exacto de `perfil_departamento`; departamento propio primero), Usuarios sin Especialidad (tabla, ficha, inline, invitación, importador la ignora), ficha de usuario «Departamentos al imputar» (conjunto exacto + vista previa), ficha y alta de empresa con departamentos, paleta de 12 colores, Tarifas/Refacturación/FichaProyecto por departamento, redirects `/admin/especialidades` y `/admin/categorias`.
- [x] Verificación UI: ciclo Departamentos+C1+C2+visibilidad 30/30; importador de usuarios 6/6; recorrido con detector 0 palabras viejas; build/tsc limpios, lint 78=78.
- [ ] **C3 (bloquea la fase 4)**: el perfil nº 7 de producción (cuenta aparecida el 30-sep) debe estar identificado antes de la 031 en producción (la migración aborta ante un perfil incoherente no declarado). Recordado en la parada.
- [ ] Lote (b) y fase 4 (promoción).

---

# LOTE v1.7 (2026-10-04) — «Profesional», «Especialidad», sección Departamentos, banner de versión

> main → demo → commit listo para promoción. SIN migración (esquema intacto: enum `rol_usuario` con valor `empleado`, tabla `categoria`, `empleado_proyecto`, `coste_empleado`, columnas y RPCs). Línea base: conteos `base17_conteos.txt` (scratchpad; imputacion 141, perfil 13) y huella ANCLA `b908bdf7` (71 claves, cruda `242545f6`).

- [x] 1. «Empleado/trabajador» → «Profesional» (presentación): 103 textos en 26 archivos por AST + 9 retoques de género/plural; alias `profesional`≡`empleado` en `rol` del importador; `docs/dia-1.md`. Supervivientes citados en PLAN.md.
- [x] 3. «Categoría» → «Especialidad» + `/admin/especialidades` con redirect; alias de cabecera `categoria`→`especialidad` (`ColumnaPlantilla.alias`/`leerXlsx`).
- [x] 2. Sección Departamentos (`/admin/departamentos`, antes de Especialidades, solo admin_grupo, sin migración).
- [x] 4. Banner «Hay una versión nueva — recarga» (`/api/version`) en los 4 shells.
- [x] Verificación local (build v1.7 contra BD demo, sesiones reales): detector 0 palabras viejas (control: 112 en la demo previa); redirect y Marina sin Departamentos; ciclo Departamentos 13/13; importadores nueva+vieja 13/13; banner 20/20; ANCLA `b908bdf7` y conteos idénticos; tsc/build limpios, lint 78=78.
- [ ] Commit, demo en verde, re-verificación en la demo desplegada, `comprobar-paridad` (PRE POR DELANTE esperable). Promoción: decisión del usuario.

---

# HOTFIX v1.6.1 — reset de contraseña colgado + línea base estable (2026-10-04)

> **PROMOCIONADO a producción** (merge `8a6ae17`, deploy SUCCESS, `comprobar-paridad` EN PARIDAD). **Post-deploy en producción CERRADO (2026-10-04)**: el usuario hizo el reset desde su cuenta sobre `prueba.noa` (modal con la temporal + login con ella verificado); después se restauró la contraseña compartida del pack a `prueba.noa` por script (la contraseña llegó por argumento, no se guardó en ningún archivo) y su login quedó verificado. Pack INTACTO por conteos (sin leer filas): 5 cuentas `prueba.*`, imputaciones 10 / ausencias 2 / asignaciones 5 / tickets 2 = foto v1.5. Distintas de la foto del 29-sep en el resto de tablas (perfil 6→7, auth.users 6→7, empleado_proyecto +2, imputacion +2, ticket +1): actividad real del usuario (las 2 imputaciones = sus líneas del 30-sep); esta sesión no creó nada en producción (sin admin temporal). Demo a 141 imputaciones tras borrar la última línea de prueba de Haizea. **Siguiente tren (v1.7)**: banner «Hay una versión nueva — recarga» vía `/api/version`.

- **Causa raíz**: el cliente llamaba a las server actions sin captura. Si la promesa se RECHAZA (red cortada, 5xx, proxy) el `await` aborta antes de `setX(false)`: botón en «Restableciendo…» para siempre, sin modal ni toast (`pageerror` sin capturar). Reproducido con control (abort y 500, código previo) y corregido. Origen del patrón: `ed53a3f` (2026-09-18, Lote 1). NINGÚN commit rompió la acción: el servidor devuelve 200 + temporal con Cristian sobre cuenta nueva y sobre Leo (restaurado a `Horas2026!`, login verificado), y la pestaña rancia con server action tras cambio de build también funciona (hipótesis refutada). El detonante concreto de ayer no es recuperable: la demo no se desplegó entre el 25-sep y hoy 17:18Z y Railway no conserva logs de despliegues retirados; lo más probable, un fallo transitorio de red/servidor.
- **Fix**: `src/lib/acciones.ts` (`llamarAccion`: siempre resuelve) aplicado a los 9 puntos de llamada de las 7 server actions (reset, recordar ×3, invitar, desactivar/reactivar, analizar/ejecutar importación). Verificado en local: con la red cortada y con 500 sale el aviso y el botón se recupera; camino feliz intacto.
- **Huella estable**: `scripts/regresion-huella.mjs`. ANCLA (jul/ago, cerrados): **71 claves, cruda `242545f6`, canónica `b908bdf7`**, medida con la demo limpia (13 perfiles) y estable en 2 ejecuciones. (Mi primera medida, con una cuenta de prueba viva, dio 73 claves/`bc819d95`: descartada; las 14 claves distintas son exactamente las que incluyen a ese empleado.) VIVA (sep/oct): informativa.
- **Verificación en demo desplegada (`04ab447`)**, 10/10 OK con cuentas ad hoc creadas y borradas (perfil/auth 13/13 antes y después): Cristian → modal con temporal → login real con ella (la inicial deja de valer); red cortada → aviso y botón NO colgado; Marina POSITIVO en su empresa (temporal + login) y NEGATIVO con la acción reenviada contra otra empresa (`Usuario no encontrado o fuera de tu ámbito`, sin contraseña; la de la víctima intacta). Lint 78 = base. Conteos = base v1.5 salvo `ticket_comentario` 5→6 (comentario real del 30-09) e `imputacion` 141→142 (una línea de Haizea de las 17:50Z, hoy, que el usuario no incluyó en su orden de borrado: queda a su decisión).

---

# LOTE v1.6 (2026-10-04) — bug del balance (Mes ≠ héroe) + paridad verificable demo↔producción

> main → demo → commit listo para promoción. Sin migraciones: las huellas de RPCs no deben moverse (SQL intacto).
> Estado v1.5 zanjado: `origin/produccion` (7898f14) contiene `c714546`; `rev-list origin/produccion..main` = 0.

- [x] 1. Causa raíz. Criterios YA alineados (héroe `sumaHoras` excluye rechazadas = `balance_mes`; comprobado en demo, Andrés y Leo, sep: suma == RPC). Divergencia = **«Mes» obsoleto**: `useBalanceMes` solo pedía el balance al montar y `EmpleadoApp` no lo refrescaba tras insertar, mientras el héroe leía `porDia` (que sí se recarga). Fix solo app (`useBalanceMes(anio, mes, horasMes)` + `horasMes` en `EmpleadoApp`). **SIN CONFIRMAR con las líneas reales de producción** (lectura denegada por el clasificador; pendiente de que el usuario ejecute la consulta).
- [x] 2a. `/api/version` (commit, rama, build). [x] 2b. `scripts/comprobar-paridad.mjs`. [x] 2c. Runbook §12 pasos 0 y 6.
- [x] Build/tsc OK, lint 78 = base 78. [x] Commits `221d361` + `31121a0` (fix del script: CLI sin extensión en Windows), demo en verde. Paridad: demo == main y 28/28 migraciones; prod NO medible hasta promocionar (aún sin `/api/version`: responde el catch-all, 307 a login).
- [x] Regresión demo (2026-10-04, sesiones reales de Cristian y Marina + service_role, `snap2.mjs`): 69 de 73 claves idénticas a la foto de v1.5 (`016e5c34`); las 4 distintas son `estado_dias_mes_9/10` de ambos, solo días que pasan de `futuro` a `incompleto` por `current_date` (28-30 sep y 1-2 oct), no por datos ni código → canónica nueva `128a913d` (cruda `e40cdd33`) = línea base vigente. Conteos idénticos salvo `ticket_comentario` 5→6: comentario «Hola» del 30-09 (actividad real posterior a v1.5, no de esta sesión, que no escribió nada en demo).
- [x] **v1.6.1 (2026-10-04) — reapertura del punto 1: la verificación visual del usuario falló en demo.** Reproducción REAL con playwright-core + Chrome sobre la URL desplegada de demo, login explícito de **Haizea** (la cuenta de su prueba: 2 líneas hoy 17:39, 1 h + 2 h) y de Leo: Inicio → Imputar hoy → Añadir → Inicio (navegación de cliente, sin F5). **Con f9f7034 desplegado el Mes SÍ se actualiza** (Haizea 3,0 → 4,0; Leo 0,0 → 1,0) y la traza de red muestra `POST imputacion` seguido de `POST rpc/balance_mes`. **CONTROL**: mismo script contra el código anterior (`c714546` compilado en local, misma BD demo): héroe 4,0 / Mes 3,0 hasta F5 y NINGUNA llamada a `balance_mes` tras el insert = el síntoma exacto reportado. Conclusión: el código del fix funciona; lo más probable es que la pestaña del usuario siguiera con el bundle anterior al despliegue (demo con el fix desde ~17:20Z, imputó a las 17:39Z). **No hay cambio de código en v1.6.1.** Descubierto y corregido: mi primer script de prueba no borraba su línea (Leo, 1 h, 05-oct) → borrada por id; el total de `imputacion` quedó en 143 = 141 base + las 2 de Haizea del usuario (se dejan: son suyas).
- [ ] Pendiente del usuario: (a) pegar el resultado de la consulta de sus líneas del 30-sep en producción (el texto recibido traía el marcador sin rellenar) → confirma o refuta la causa del punto 1; (b) verificación visual en demo: imputar una línea y ver «Mes» actualizarse sin recargar (sin navegador en la sesión); (c) promoción de v1.6 con `comprobar-paridad` antes y después.

---

# LOTE v1.5 (2026-09-25) — categoría en ficha + pestañas con iconos en Empresas y Proyectos

- [x] 1. Causa raíz de «categoría no seleccionable»: hipótesis (hook filtrado) REFUTADA; no reproducible ni en la UI equivalente ni en BD; auditoría de selects citada y `opcionesCategoria/opcionesDepartamento` como única fuente.
- [x] 2. Pestañas `?vista=` en Empresas y Proyectos (+ formularios desplegables). [x] 3. Iconos en pestañas (Importar, Costes nuevos).
- [x] Verificación (F5/atrás, round-trip en pestaña, ambos temas, AE), conteos/huellas idénticos, build/lint sin nuevos. Pendiente: commit/push, demo en verde, promoción (sin migraciones).

---

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

## Revisión (v1.4 + 029)
- Migración 029 (jornada por defecto 8/8/8/8/5,5/0/0 editable; `jornada_horas` obsoleto) aplicada a la demo y verificada; el punto 2 pasó de «sin 029» a 029 por decisión del usuario. 3 importadores + 3 exports + paridad ficha↔inline. Verificado con sesión real de Cristian; conteos y huellas idénticos; build/lint sin nuevos.

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


---

# LOTE v2.0.1 — UX de Departamentos: de edición inline a ficha (solo app, sin migración)
- [x] Listado solo-filas (`row-link` + «Ver»; sin Abrir/Cerrar ni acordeón); card Importar/Exportar se queda en el listado.
- [x] Ficha `/admin/departamentos/<id>` (`rutas.ts`: `departamentos.ficha = true`): cabecera (punto de color grande, estado, «‹ Volver»), Datos (nombre, responsable, color), **Empresas donde existe** (2.f: fila por empresa con casilla, nº de profesionales de ESA empresa en ESTE departamento y enlace a su ficha), Especialidades, Acciones (desactivar con su guarda).
- [x] «＋ Nuevo departamento» navega a la ficha si se crea uno (si son varios, se queda en el listado).
- [x] 2.f: UNA mutación sobre `empresa_departamento` (`lib/departamentos/vinculo-empresa.ts`) compartida por la ficha del departamento y la de la empresa; quitar una empresa con profesionales EN ACTIVO asignados → «Reubica antes a sus N profesionales.». La ficha de la empresa NO enlazaba de vuelta (el encargo lo daba por hecho): ahora cada departamento de su card lleva «Ver» → ficha del departamento.
- [x] Verificado en navegador real (Cristian): `pw_v201.mjs`, 41/41; control contra el código anterior falla; huella ANCLA `600be8b5`/`ea31926b`/`53553bd7` y conteos sin cambios; tsc limpio, lint 78 (= base), build OK.
