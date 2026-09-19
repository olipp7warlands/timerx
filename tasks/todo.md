# TODO — Combinado 5+2 (migraciones 018-019) → Lote 4 (migración 020)

> Orden fijado por el usuario: el combinado 5+2 se ejecuta ENTERO (018, 019) con verificación completa y desplegado ANTES de arrancar el Lote 4.
> `mocks/panel_administracion.html` (259 líneas sin commitear) es la versión acumulada correcta y va en el commit del combinado.
> Cerrados y desplegados: Lote 1.5 (URLs), Lote 3 (importadores) y seguimiento MODO_EMAIL — ver PLAN.md.

## A. Sin email (decisión definitiva)
- [x] A1. Alta manual con campo de contraseña inicial + botón Generar (patrón Xxxxx-1234 del reset, visible para copiar). Importador queda igual (sin contraseña, acceso vía Restablecer). Un solo generador compartido. PLAN.md documenta ambos caminos.
- [x] A2. Runbook: SMTP/Resend/MODO_EMAIL=real dejan de ser prerequisitos → "Futuro opcional: activar email". Recovery de /login inerte también en producción (cambio de contraseña desde el menú del avatar); cron/botón Recordar siguen en modo log (registran sin enviar).

## B. Soporte (migración 018)
- [x] B1. Esquema: `ticket` (ref secuencial T-001 generada en BD), `ticket_comentario`; enums tipo/estado; RLS (empleado propios; admin_empresa su empresa; admin_grupo todo; estado solo admins; sin delete).
- [x] B2. Empleado (4 shells): "Soporte" en el menú del avatar entre Cambiar contraseña y Cerrar sesión → modal/hoja: mis tickets + hilo + comentar + Nuevo ticket.
- [x] B3. Admin escritorio: sección Soporte (Operación, tras Control), `/admin/soporte` y `/admin/soporte/<id>`; filtros, tabla row-link, ficha con hilo, responder (abierto→en_curso), Marcar en curso/resuelto/Reabrir. Admin móvil: pantalla funcional en el drawer.
- [x] B4. Badge nº de tickets abiertos junto a Soporte en el sidebar admin.
- [x] B5. Seed demo: T-014..T-017 literales del mock (hilos, autores, estados).

## C. Jornada semanal + resúmenes de día (migración 019 — núcleo delicado)
- [x] C0. Foto base ANTES de la 019 (fte_mes, balance_mes_empleado, estado_dias_mes + resumen_dia/mes, faltantes) y citar qué funciones de la familia tocan jornada/laborables.
- [x] C1. `empresa_jornada` (7 filas por empresa; seed 7h L-V / 0 S-D).
- [x] C2. `jornada_del_dia()` helper único; `es_laborable`, `horas_requeridas` generalizados; parchear SOLO las funciones demostradas.
- [x] C3. Regresión byte-idéntica con el seed plano.
- [x] C4. Caso Wowinx 8/8/8/8/5,5 → sep 2026 = 176,0 h (y requeridas efectivas de Andrés con su baja); revertir a 7 plano; repetir regresión.
- [x] C5. UI jornada semanal en Calendario (admin_grupo).
- [x] C6. Resumen del día (`/admin/calendario?dia=YYYY-MM-DD`), ámbito como resumen_dia.
- [x] C7. Mini-calendario en la ficha de usuario (sin SQL nueva sin reporte).

## Verificación (local + producción) y cierre
- [x] Ciclo Soporte con sesiones reales, ámbitos, RLS con intentos reales, ref sin colisiones, revertido.
- [x] Alta manual con contraseña: crear, login con ella, revertir.
- [x] Jornada: regresión + caso 176,0 + resumen 11-sep vs faltantes de Control + mini-calendario de Andrés + `?dia=` F5/atrás + 3 identidades.
- [x] Capturas contra el mock; build; commit+push (con el mock); redeploy; regresión REPETIDA en producción; conteos idénticos salvo los 4 tickets (commits eeb3a20 + el del panel 'soloMios').

## Lote 4 (migración 020) — YA PUEDE ARRANCAR: combinado 5+2 cerrado y desplegado (018, 019). Pendiente de que el usuario lo confirme.

## Revisión
- Línea base previa (Lote 3): conteos y hash `756660c9…` de fte/balance/estado sep+oct (scratchpad). Para la 019 se toma una foto ampliada (resumen_dia/mes, faltantes) antes de migrar.
