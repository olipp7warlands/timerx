# Horas Grupo — Plan de construcción

Herramienta interna de imputación de horas para un grupo de empresas, con reporting FTE mensual y refacturación de servicios intragrupo. Este documento es el plan de trabajo para construirla con Claude Code.

---

## 1. Fuentes de verdad (no reinterpretar)

| Archivo | Qué define |
|---|---|
| `mocks/app_movil_empleado.html` | Empleado · móvil: pantallas, flujos (hoja por pasos), estados y diseño exactos |
| `mocks/empleado_web.html` | Empleado · escritorio: layout web-nativo (filas + calendario lateral), composer inline |
| `mocks/panel_administracion.html` | Admin · escritorio: sidebar, home KPIs, todas las secciones |
| `mocks/admin_movil.html` | Admin · móvil: drawer lateral, home día+mes, bandeja de ausencias |
| `supabase/migrations/001_esquema_inicial.sql` | Esquema base: empresas, proyectos, categorías, perfiles, tarifas, periodos, imputaciones, vistas de valoración y refacturación, RLS |
| `supabase/migrations/002_departamentos_ausencias_calendario.sql` | Departamentos, festivos y ajustes, ausencias con aprobación, faltantes y base FTE |

Los mockups son la especificación de UI/UX validada por el cliente: replicar 1:1 (layout, textos, estados, navegación). Los estilos ya están extraídos como tokens (sección 3).

**Matriz rol × dispositivo**: cada rol tiene DOS layouts sobre la misma lógica y los mismos componentes. No es responsive por estiramiento: en cada breakpoint (~980 px) se cambia la disposición según el mock correspondiente. Empleado: móvil = 3 pestañas + FAB + hojas inferiores por pasos; escritorio = sidebar plegable + composer inline con selects + modales centrados. Admin: escritorio = sidebar completo; móvil = drawer (hamburguesa) con las mismas 11 secciones agrupadas, home que fusiona día + resumen del mes, Ausencias funcional, y las secciones de gestión pura remiten al escritorio.

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

### 3.1 Patrones de implementación validados en los mocks
- **Delegación de eventos**: toda la interacción de listas re-renderizables pasa por atributos `data-act` y un manejador delegado (en React: handlers en el contenedor o por render declarativo, jamás bindings imperativos que se pierdan al repintar). Este patrón resolvió el bug de "Confirmar" del prototipo y es norma.
- **Estado de formularios sobrevive al re-render**: los selects/steppers del composer del precargado conservan su valor cuando el bloque se repinta (en React sale gratis con estado controlado; no usar `defaultValue` no controlado en estos casos).
- Quesos = `conic-gradient`; barras = divs; sin librería de gráficos. Cifras siempre en IBM Plex Mono con `tabular-nums` y formato es-ES (coma decimal).
- **Todo cambio en policies o funciones `security definer` re-ejecuta las verificaciones de alcance de los roles NO afectados por el cambio** (mínimo: un empleado normal, un admin_empresa, admin_grupo), con salida SQL. Un fix de RLS sin retest de regresión no cierra checkpoint.

### 3.2 Divergencias deliberadas del mock (decisiones cerradas, no deuda)
- **Selector de rango de fechas en ausencias**: dos toques explícitos (primero = inicio, segundo = fin, tercero reinicia), nunca colapsar una selección multi-día suelta a min→max. El mock no distingue el gesto; se fija esta interacción como norma para evitar ambigüedad sobre qué días quedan seleccionados.
- **Campo "Cliente" en alta de proyecto** (`panel_administracion.html`, sección Proyectos): se omite. La tabla `proyecto` no tiene esa columna y no se añade — el "cliente" de un proyecto en este modelo YA es su empresa del grupo (`proyecto.empresa_id`, la destinataria de horas y de refacturación); un campo de texto libre duplicaría ese dato y podría contradecirlo. Si en el futuro hace falta un cliente externo al grupo, es un modelo de datos distinto (tabla `cliente`), no un texto suelto.
- **Tarifas: identidad del empleado en tarifas personales**. `tarifa_select` es visible para ambos roles admin por diseño (todo el grupo); pero cuando la tarifa es personal (`empleado_id` no nulo) y ese perfil no es visible para quien consulta (fuera de su ámbito de `perfil_select`), el `join` devuelve `null`. Decisión: no ensanchar `perfil_select` por este motivo (sería relajar RLS por algo cosmético, justo lo contrario de 007/008), ni mostrar iniciales (sigue exponiendo identidad parcial sin necesidad). Se resuelve en presentación: la celda muestra el placeholder explícito "Empleado de otra empresa" (`ink-tertiary`, `title="Tarifa personal fuera de tu ámbito"`) en vez de quedar en blanco — el dato que sí concierne al admin (existe una tarifa personal, a qué precio, con qué vigencia) queda íntegro, y la ocultación se lee como intencional, no como un bug.

## 4. Reglas de negocio (resumen ejecutable)

1. **Imputación diaria**: el empleado imputa horas por día sobre subcategorías (tareas) de proyectos a los que está asignado (`empleado_proyecto`). Empresa y categoría van implícitas (proyecto → empresa destino; subcategoría → categoría). Jornada 7 h/día laborable; tope duro 12 h/día (trigger).
2. **Estados**: `borrador → enviada → aprobada|rechazada → cerrada`. Aprueban admin de la empresa destino o admin de grupo. El cierre de periodo (mes) congela todo.
   **Qué estados cuentan según el consumidor** (no reabrir sin motivo — documentado también como comentario en `005_fte_mes_solo_confirmadas.sql`): `balance_mes()` (saldo propio del empleado, mes en curso) suma `estado <> 'rechazada'` — todo lo suyo salvo lo explícitamente rechazado, porque el empleado necesita ver su propio progreso aunque aún no esté aprobado. `fte_mes()` (reporting/FTE de admin, base del Excel oficial) suma **solo** `estado in ('aprobada','cerrada')` — un borrador o una imputación enviada todavía no está confirmada, no debe figurar en el informe de horas del grupo.
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
Replicar `app_movil_empleado.html` (móvil) y `empleado_web.html` (escritorio) con componentes compartidos:
- Inicio: tarjeta de hoy + KPIs mes/requeridas/balance, carrusel "Últimos días imputados" con **Reutilizar** (precarga staged), calendario del mes.
- Imputar: navegación de días, bloque **Precargado** (steppers ±0,5 h por línea, "＋ Imputar nueva tarea" al lote, Confirmar/Descartar → inserta como `borrador`), cuadro del día con CTA punteado, "Últimas imputaciones" agrupadas por día con "Usar", popup "Imputaciones anteriores".
- Hoja de nueva imputación: Proyecto|Ausencia → proyecto → tarea (agrupada por categoría con cat-dot) → horas (stepper, atajos, multi-día) / tipo de ausencia → días → `solicitar_ausencia()`.
- Calendario: mes con estados + lista de ausencias propias.

**Layout web (escritorio, `empleado_web.html`)** — mismo estado y lógica, otra disposición:
- Sidebar plegable (chevron → 64 px solo iconos) con Inicio / Imputar / Calendario y pie con tema + enlace al panel admin.
- **Imputar = filas apiladas + calendario lateral**: columna principal con 3 filas (1· tira de fecha: flechas + total + barra + estado; 2· imputación del día: tabla editable proyecto·tarea / empresa / horas ± / eliminar, con **composer inline al pie** — select de proyecto con su empresa, select de tarea con `optgroup` por categoría, stepper, botón Añadir; 3· anteriores imputaciones) y columna derecha de 400 px con el **calendario del mes grande y sticky**, operativo: clic en día laborable → lo carga en el editor.
- **Precargado (staged)**: líneas con stepper ±0,5 h, **composer propio "＋ Añadir al lote"** (misma fila de selects) y Confirmar (total en vivo) / Descartar. "Reutilizar día" desde Inicio precarga sobre **hoy**; desde Imputar, sobre el **día seleccionado**.
- **Módulo `FilaDia` compartido** entre Inicio ("Últimos días imputados") e Imputar ("Anteriores imputaciones"): fecha+total | líneas con horas | botón "Reutilizar día". La repetición de líneas sueltas ("Usar") vive solo en el modal "Ver todo".
- Modales **centrados** (no hojas inferiores) únicamente para: histórico completo y solicitud de ausencia (formulario directo: tipo + desde/hasta).
- En móvil (<~980 px o user-agent móvil) se sirve el layout del mock móvil: pestañas + FAB + hojas por pasos.
- **Hecho cuando**: el flujo completo de AMBOS mocks funciona contra Supabase real, incluido reutilizar+ajustar+añadir al lote+confirmar y solicitar vacaciones, en los dos layouts.

### F3 · Panel de administración (2–3 días)
Replicar `panel_administracion.html`:
- Sidebar plegable con grupos e iconos; home con día navegable (KPIs + pendientes + ausentes), mes navegable (KPIs + calendario sincronizado + quesos + refacturación), botones directos.
- Secciones: Usuarios (invitar vía service role), Ausencias (bandeja aprobar/rechazar → RPCs), Empresas, Proyectos (con **ficha de proyecto**: queso por categoría, departamentos, personas), Categorías, Calendario (jornada, festivos, requeridas/mes), Control (`faltantes()` + imputación directa), Tarifas, Refacturaciones (detalle + cierre), Ajustes (tabla `ajuste`).
- **Layout móvil (`admin_movil.html`)**: sin tabbar — **drawer lateral** (hamburguesa en cabecera) con las 11 secciones agrupadas (General/Personas/Estructura/Operación/Sistema), activo con franja de 3 px. Home = bloque del día (KPIs 2×2 + pendientes con Recordar + ausentes) seguido del **Resumen del mes completo** (navegador ‹›, KPIs, barras por empresa, queso de proyectos en grises, refacturación con total). Ausencias funcional (aprobar/rechazar). Las secciones de gestión (Usuarios, Empresas, Proyectos, Categorías, Calendario, Control, Tarifas, Refacturaciones, Ajustes) muestran pantalla de remisión al escritorio: en móvil el admin vigila y aprueba, no configura.
- **Hecho cuando**: cada card de ambos mocks muestra datos reales y las acciones (aprobar ausencia, crear tarifa, festivo) persisten.

### F3.5 · Despliegue de demo (Railway) — hecho antes de F4

Objetivo: app accesible desde un móvil real y enseñable, contra el Supabase real (Timerx), sin tocar el dataset de seed.

**URL pública**: `https://timerx-production.up.railway.app`

- **Proyecto Railway**: ya existía un proyecto `timerx` (servicio `timerx`, entorno `production`) conectado a `olipp7warlands/timerx` rama `main` con autodeploy — no se creó nada nuevo, solo se enlazó el repo local (`railway link`) y se completó lo que faltaba: variables, dominio, cabeceras. Build con Railpack (autodetecta Node/Next.js vía `railpackInfo` — sin Dockerfile ni `railway.toml`; no hizo falta tocar puerto/host, Next.js escucha en `$PORT` automáticamente bajo Railpack).
- **Variables** (`railway variable set`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Ninguna es "solo servidor" a nivel Railway — esa distinción la hace Next.js en build: solo `NEXT_PUBLIC_*` se inlinea en los chunks de cliente. Verificado con `grep` del valor literal de `SUPABASE_SERVICE_ROLE_KEY` sobre `.next/static` tras un build local con las mismas variables → **cero coincidencias en todo `.next`, ni siquiera en chunks de servidor** (Next.js lee `process.env` en runtime, nunca inlinea vars sin el prefijo). Como control de que el método de búsqueda era válido, el mismo `grep` con el valor de `NEXT_PUBLIC_SUPABASE_ANON_KEY` sí aparece en un chunk de cliente, como corresponde.
- **Dominio**: generado con `railway domain` (no existía ninguno todavía). Tras fijar las variables `NEXT_PUBLIC_*` hizo falta un **redeploy** (`railway redeploy`) porque esas variables se compilan en build time, no en runtime — el deployment ya "SUCCESS" en el repo no las tenía.
- **Supabase Auth**: `site_url` cambiado a la URL de Railway (antes `http://localhost:3000`) y `additional_redirect_urls` con los puertos locales (`3000`, `3002`, `127.0.0.1:3000`) para que el desarrollo local siga funcionando con `redirectTo` explícito. Aplicado vía `supabase config pull` + `supabase config push`, con un `supabase/config.toml` **deliberadamente mínimo** (solo declara `project_id` y `[auth].site_url`/`additional_redirect_urls`): un primer `config pull` completo trajo toda la configuración remota (storage, realtime, pooler, mfa, sms...) y el diff previo a pushear reveló que habría **desactivado Twilio SMS** (activo en remoto) como efecto colateral de plantillas por defecto de `supabase init` — se recortó el archivo a solo lo que esta tarea necesita gestionar, así ningún push futuro puede tocar configuración ajena sin declararla explícitamente primero.
- **Cabecera `X-Powered-By: Next.js`**: detectada al auditar cabeceras del despliegue real, eliminada con `poweredByHeader: false` en `next.config.ts`. Resto de cabeceras revisadas en `/`, `/admin`, `/login` — nada más que exponer.
- **Verificaciones contra el despliegue real** (no local): `/debug`, `/debug/movil`, `/debug/movil-admin` → 404 (`curl` directo al dominio público); magic link de Andrés generado con `redirectTo` al dominio de Railway, sesión establecida y home real cargando datos reales; intento de imputar en un día ya al tope (12 h) rechazado por el trigger sin insertar fila — confirmado por SQL antes/después, dataset de seed intacto; `/admin` gated en el dominio real para Andrés (→ `/`) y Cristian (panel completo).
- **No se tocaron datos**: ninguna de las pruebas anteriores dejó una imputación, ausencia ni fila nueva en el seed — es el escenario que se enseña.

### F4 · Cierre y exports (1 día)
- `cerrar_periodo()` con precondiciones (sin faltantes, sin horas sin tarifa) y UI de bloqueo con motivos.
- Exports `exceljs`: FTE mensual (formato exacto del Excel del cliente) y refacturación. Endpoints server-side.

### F5 · Aprobación de imputaciones (1 día)
- Envío de borradores (semana/mes), bandeja de aprobación por empresa destino, rechazo con motivo visible en la app.

### F6 · Recordatorios y pulido (1 día)
- Cron Railway diario: `faltantes(hoy-5, hoy)` → email Resend si `ajuste.recordatorio_email`.
- QA móvil real, estados vacíos, accesibilidad (focus visible, aria de las hojas).
- Despliegue base (Railway + dominio + variables) ya hecho en **F3.5**, contra el Supabase de demo — revisar antes de dar F6 por cerrada si el destino final de producción es el mismo proyecto Supabase/Railway o uno nuevo (credenciales, dominio propio, `additional_redirect_urls` de producción real en vez de las de demo/local).
- **Verificación de despliegue**: `/debug`, `/debug/movil` y `/debug/movil-admin` devuelven 404 en el build de producción — ya confirmado en F3.5 contra el propio despliegue de Railway; repetir si cambia el servicio o el dominio de destino.

## 6. Seed de desarrollo

Empresas: Wowinx SL (B-11223344), Málaga CF SAD (A-99887766), Legal Norte SL (B-55667788). Departamentos: 3B3 (responsable Cristian Haro), Jurídico, Diseño. Categorías/subcategorías y proyectos: los de los mocks (Interno no refacturable). Usuarios (11): Cristian Haro (admin_grupo), Verónica Salguero, Andrés Fuentes, Leo Silva, Sara Martín, Ana Ruiz (Legal Norte), Cosme Hernandez, Daniel Ramírez, Marta Gil (Jurídico), Enrique Robles (empleado moroso de Málaga, usado en los mocks con vacaciones rechazadas y faltantes) y Marina Ortega (admin_empresa de Málaga CF SAD — persona aparte, no es Enrique). Tarifas: Desarrollo 60, Diseño 55, Abogados 95 (origen Legal Norte), Ana Ruiz 110. Imputaciones de julio y agosto completas (meses cerrados), septiembre parcial replicando los números de los mocks; 1 baja aprobada (Andrés 01–02/09), 2 vacaciones pendientes.

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
/mocks/                      ← los cuatro HTML (referencia, no se sirven)
/supabase/migrations/        ← 001, 002
/supabase/seed.sql
/src/app/(empleado)/...      ← inicio, imputar, calendario + hoja
/src/app/admin/...           ← layout sidebar + 11 secciones
/src/lib/supabase/           ← clientes server/browser, tipos generados
/src/components/ui/          ← Card, Kpi, Dot, Donut, Hbar, Sheet, Acal…
PLAN.md
```
