# Horas Grupo — Plan de construcción

Herramienta interna de imputación de horas para un grupo de empresas, con reporting FTE mensual y refacturación de servicios intragrupo. Este documento es el plan de trabajo para construirla con Claude Code.

---

## 1. Fuentes de verdad (no reinterpretar)

| Archivo | Qué define |
|---|---|
| `mocks/app_movil_empleado.html` | App del empleado (móvil): pantallas, flujos, estados y diseño exactos |
| `mocks/panel_administracion.html` | Panel de administración (escritorio): sidebar, home KPIs, todas las secciones |
| `supabase/migrations/001_esquema_inicial.sql` | Esquema base: empresas, proyectos, categorías, perfiles, tarifas, periodos, imputaciones, vistas de valoración y refacturación, RLS |
| `supabase/migrations/002_departamentos_ausencias_calendario.sql` | Departamentos, festivos y ajustes, ausencias con aprobación, faltantes y base FTE |

Los mockups son la especificación de UI/UX validada por el cliente: replicar 1:1 (layout, textos, estados, navegación). Los estilos ya están extraídos como tokens (sección 3).

## 2. Stack y arquitectura

- **Supabase**: Postgres 15 + Auth (email/invitación) + RLS. Toda la lógica de negocio crítica vive en SQL (triggers, RPCs, vistas): el frontend nunca calcula tarifas ni valida topes.
- **Railway**: una app **Next.js 14+ (App Router, TypeScript, Tailwind)** que sirve las dos superficies:
  - `/` → app del empleado (mobile-first, tres pestañas + hoja de imputación)
  - `/admin` → panel (sidebar plegable, 11 secciones)
- Librerías: `@supabase/supabase-js` + `@supabase/ssr`, `exceljs` (exports), `date-fns` (con locale es), sin librería de gráficos (los quesos son `conic-gradient`, las barras son divs, como en los mocks).
- Emails de recordatorio: Resend + cron de Railway (fase 6).
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo server), `RESEND_API_KEY`.

## 3. Sistema de diseño «Amable-gris»

Copiar los tokens tal cual a `globals.css` / config de Tailwind:

- Tipografías: **Nunito** (500–800) para todo; **IBM Plex Mono** para cifras y datos (`font-variant-numeric: tabular-nums`).
- Claro: fondo `#F6F6F4`, superficie `#FFFFFF`, sutil `#EFEFEC`, bordes `#E9E9E6`/`#D8D8D4`, tinta `#2E2E2B`/`#5C5C58`/`#8A8A85`/`#C4C4C0`, acción `#3A3A36` sobre blanco.
- Oscuro (conmutable, arranca según `prefers-color-scheme`): fondo `#141413`, superficie `#1D1D1B`, sutil `#262623`, tinta `#F0F0ED`…, acción invertida `#F0F0ED` sobre `#1B1B19`.
- Color SOLO en categorías: desarrollo `#5E7A8C`, diseño `#8C7A5E`, abogados `#7C6480`, gestión `#6E8B72` (variantes claras en modo oscuro, ver mocks).
- Estados sin color: punto relleno = completo/aprobado; punto hueco = parcial/pendiente; punto gris = futuro/inactivo; rechazado = tachado.
- Formas: tarjetas 16–18 px con sombra suave, botones píldora (primario oscuro), inputs rellenos sin borde, hoja inferior móvil 26 px, botón "añadir en vacío" cuadrado con borde discontinuo.

## 4. Reglas de negocio (resumen ejecutable)

1. **Imputación diaria**: el empleado imputa horas por día sobre subcategorías (tareas) de proyectos a los que está asignado (`empleado_proyecto`). Empresa y categoría van implícitas (proyecto → empresa destino; subcategoría → categoría). Jornada 7 h/día laborable; tope duro 12 h/día (trigger).
2. **Estados**: `borrador → enviada → aprobada|rechazada → cerrada`. Aprueban admin de la empresa destino o admin de grupo. El cierre de periodo (mes) congela todo.
3. **Requeridas**: laborables del mes × jornada, descontando festivos (grupo o empresa) y días con ausencia aprobada.
4. **Ausencias**: solicitud desde la app (vacaciones/baja/permiso) → aprueba responsable de departamento o admin. Aprobada = bloquea imputación esos días y descuenta requeridas.
5. **Tarifas**: `resolver_tarifa()` — prioridad empleado > categoría; filtro opcional por empresa origen; vigencias por fecha. Horas sin tarifa bloquean el cierre.
6. **Refacturación**: solo si `empresa_origen (del empleado) ≠ empresa_destino (del proyecto)` y el proyecto es refacturable. Vista `v_refacturacion_mensual`.
7. **Excel FTE mensual**: columnas Empleado · Horas Imputadas · Horas Requeridas · Vacaciones (días) · Bajas (días) · Proyecto · Horas Proyecto · FTE s/imputadas · FTE s/requeridas; ausencias también como líneas "(ausencia)". Base: `fte_mes(anio, mes)`.

## 5. Fases

### F1 · Cimientos (medio día)
- Repo Next.js + Tailwind con tokens; layout raíz con tema claro/oscuro.
- Proyecto Supabase; aplicar migraciones 001 y 002; `supabase/seed.sql` (sección 6).
- Auth por invitación (email + magic link), middleware de sesión, hook `usePerfil()`.
- **Hecho cuando**: login funciona, un empleado ve solo sus proyectos asignados vía RLS (probar con dos usuarios).

### F2 · App del empleado (2–3 días)
Replicar `app_movil_empleado.html`:
- Inicio: tarjeta de hoy + KPIs mes/requeridas/balance, carrusel "Últimos días imputados" con **Reutilizar** (precarga staged), calendario del mes.
- Imputar: navegación de días, bloque **Precargado** (steppers ±0,5 h por línea, "＋ Imputar nueva tarea" al lote, Confirmar/Descartar → inserta como `borrador`), cuadro del día con CTA punteado, "Últimas imputaciones" agrupadas por día con "Usar", popup "Imputaciones anteriores".
- Hoja de nueva imputación: Proyecto|Ausencia → proyecto → tarea (agrupada por categoría con cat-dot) → horas (stepper, atajos, multi-día) / tipo de ausencia → días → `solicitar_ausencia()`.
- Calendario: mes con estados + lista de ausencias propias.
- **Hecho cuando**: el flujo completo del mock funciona contra Supabase real, incluido reutilizar+confirmar y solicitar vacaciones.

### F3 · Panel de administración (2–3 días)
Replicar `panel_administracion.html`:
- Sidebar plegable con grupos e iconos; home con día navegable (KPIs + pendientes + ausentes), mes navegable (KPIs + calendario sincronizado + quesos + refacturación), botones directos.
- Secciones: Usuarios (invitar vía service role), Ausencias (bandeja aprobar/rechazar → RPCs), Empresas, Proyectos (con **ficha de proyecto**: queso por categoría, departamentos, personas), Categorías, Calendario (jornada, festivos, requeridas/mes), Control (`faltantes()` + imputación directa), Tarifas, Refacturaciones (detalle + cierre), Ajustes (tabla `ajuste`).
- **Hecho cuando**: cada card del mock muestra datos reales y las acciones (aprobar ausencia, crear tarifa, festivo) persisten.

### F4 · Cierre y exports (1 día)
- `cerrar_periodo()` con precondiciones (sin faltantes, sin horas sin tarifa) y UI de bloqueo con motivos.
- Exports `exceljs`: FTE mensual (formato exacto del Excel del cliente) y refacturación. Endpoints server-side.

### F5 · Aprobación de imputaciones (1 día)
- Envío de borradores (semana/mes), bandeja de aprobación por empresa destino, rechazo con motivo visible en la app.

### F6 · Recordatorios y pulido (1 día)
- Cron Railway diario: `faltantes(hoy-5, hoy)` → email Resend si `ajuste.recordatorio_email`.
- QA móvil real, estados vacíos, accesibilidad (focus visible, aria de las hojas), deploy Railway + dominio.

## 6. Seed de desarrollo

Empresas: Wowinx SL (B-11223344), Málaga CF SAD (A-99887766), Legal Norte SL (B-55667788). Departamentos: 3B3 (responsable Cristian Haro), Jurídico, Diseño. Categorías/subcategorías y proyectos: los de los mocks (Interno no refacturable). Usuarios: Cristian Haro (admin_grupo), Verónica Salguero, Andrés Fuentes, Leo Silva, Sara Martín, Ana Ruiz (Legal Norte), Cosme Hernandez, Daniel Ramírez, Marta Gil (Jurídico), Enrique Robles + 1 admin_empresa Málaga. Tarifas: Desarrollo 60, Diseño 55, Abogados 95 (origen Legal Norte), Ana Ruiz 110. Imputaciones de julio y agosto completas (meses cerrados), septiembre parcial replicando los números de los mocks; 1 baja aprobada (Andrés 01–02/09), 2 vacaciones pendientes.

## 7. Prompt inicial para Claude Code

```
Lee PLAN.md entero antes de escribir nada. Vamos a construir "Horas Grupo".

Reglas de trabajo:
- Los mocks de /mocks son la especificación de UI: replica layout, textos,
  estados y modo oscuro exactamente, extrayendo los tokens CSS a Tailwind.
- Toda la lógica de negocio está en /supabase/migrations: úsala (RPCs, vistas,
  triggers), no la dupliques en el cliente.
- TypeScript estricto, componentes de servidor por defecto, cliente solo donde
  hay interacción. Nada de librerías de UI ni de charts.

Tarea 1 (F1 del plan):
1. Inicializa Next.js 14 + Tailwind con los tokens del sistema Amable-gris
   (sección 3 del plan) y soporte de tema claro/oscuro por data-theme.
2. Conecta Supabase (@supabase/ssr), aplica las migraciones 001 y 002 y crea
   supabase/seed.sql según la sección 6.
3. Auth por invitación con magic link, middleware de sesión y hook usePerfil.
4. Página de smoke-test /debug que liste mis proyectos asignados (verifica RLS).
Al terminar: git add, resumen de decisiones y siguiente paso propuesto.
```

## 8. Estructura de repo propuesta

```
/mocks/                      ← los dos HTML (referencia, no se sirven)
/supabase/migrations/        ← 001, 002
/supabase/seed.sql
/src/app/(empleado)/...      ← inicio, imputar, calendario + hoja
/src/app/admin/...           ← layout sidebar + 11 secciones
/src/lib/supabase/           ← clientes server/browser, tipos generados
/src/components/ui/          ← Card, Kpi, Dot, Donut, Hbar, Sheet, Acal…
PLAN.md
```
