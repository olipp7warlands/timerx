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
- [ ] Capturas contra el mock; build; commit + push; redeploy; retest en producción (login explícito por identidad).

## Hallazgos abiertos (tareas separadas, NO tocadas)
- [ ] **SEGURIDAD**: `perfil_update_admin` permite a un admin_empresa cambiar `rol` (incluido el suyo a `admin_grupo`) por API directa. Reproducido y revertido. Requiere guarda + retest de 3 identidades. Pendiente de confirmación del usuario.
- [ ] `resumen_dia`/`resumen_mes`: `order by` sin desempate (huella cruda frágil). Regresión con huella canónica `6c50f784`.

## Revisión
- Lote 4 completo en local; pendiente: commit/push, redeploy y retest en producción con login explícito (ver PLAN.md).
