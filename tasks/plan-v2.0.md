# PLAN v2.0 — Consolidación del modelo: Empresa → Proyectos + Departamentos → Especialidades

> **Estado: SOLO PLAN (2026-10-04).** Ni código ni migración hasta aprobación explícita. Inventario medido en el repo, en la demo (filas) y en producción (**solo conteos**, `count` sin traer filas).
> Convención: «superviviente» = identificador de esquema/código que se conserva a propósito (doctrina de siempre).

---

## 0. Resumen ejecutivo

1. **Hallazgo que condiciona todo el plan**: `categoria` no es solo el agrupador del selector de tareas. **Es la clave del dinero**: `tarifa.categoria_id` (CHECK «categoría XOR empleado»), `resolver_tarifa(…, categoria_id, …)`, las vistas `v_imputacion_valorada` / `v_refacturacion_mensual` (agrupan por categoría) y `cerrar_periodo` (valida «sin tarifa» con `s.categoria_id`, definido en 006/009/011/023). Quitar `categoria` «de verdad» obliga a reescribir tarifas, refacturación y cierre de periodo.
2. **Recomendación (D3)**: **modelo «espejo 1:1»**. `categoria` se queda físicamente pero pasa a ser el *espejo* de su departamento (una categoría por departamento, invariante `departamento_id NOT NULL UNIQUE` y nombre sincronizado por trigger). La app deja de mostrar «categoría» como concepto. **Cero cambios** en `imputacion`, `subcategoria`, `tarifa`, `resolver_tarifa`, vistas valoradas y `cerrar_periodo` → la huella numérica y el dinero no se mueven. La alternativa «limpia» (columnas `departamento_id` en `subcategoria` y `tarifa` + reescritura de 6 funciones/vistas) es más pura pero toca el camino del dinero en producción; queda como limpieza posterior opcional.
3. **Datos**: producción es pequeña y **no tiene dinero todavía** (0 tarifas, 0 periodos, 0 imputaciones cerradas, 15 imputaciones). La demo es la que tiene tarifas, 141 imputaciones y 3 periodos cerrados por empresa.
4. **Dos migraciones**: **030 aditiva** (tablas/columnas nuevas; compatible con la app v1.7; desplegable días antes) y **031 «de conmutación»** (renombres, enlace de Gestión, población de `empresa_departamento`; se aplica justo antes de promocionar la app). Reversa determinista con una tabla de respaldo creada por la propia migración.
5. **Las huellas SÍ cambiarán, de forma explicable**: los `resumen_*` devuelven el *nombre* del departamento. Se propone una huella **enmascarada** (sin nombres de departamento) que debe ser **idéntica** y una huella normal que cambia solo en cadenas de nombre.

---

## 1. Inventario real

### 1.1 Esquema afectado (qué toca cada pieza)

| Pieza | Hoy | Papel en v2.0 |
|---|---|---|
| `departamento` (002; RLS 024: escribe solo admin_grupo) | id, nombre UNIQUE, responsable_id, activo, created_at. Agrupa **personas** (`perfil.departamento_id`) y define responsable que aprueba ausencias | Pasa a agrupar también las **especialidades**. Gana `color` (D12) |
| `categoria` (001, 015) | id, nombre UNIQUE, activa, `departamento_id` NULL = **global/transversal** | **Espejo 1:1** de departamento (D3). Deja de ser concepto visible. Superviviente |
| `subcategoria` (001) | id, `categoria_id` NOT NULL, nombre, activa, UNIQUE(categoria_id, nombre) | **ES la especialidad** (renombrada de concepto). Sin cambios de esquema bajo D3 |
| `imputacion.subcategoria_id` (001) | FK a la tarea | **No se mueve.** Ninguna imputación se toca |
| `tarifa` (001) | `categoria_id` XOR `empleado_id`, `empresa_origen_id`, `coste_hora`, vigencias | Sin cambios bajo D3: «tarifa por categoría» = tarifa por **departamento** (vía espejo). La UI lo llama Departamento |
| `resolver_tarifa`, `v_imputacion_valorada`, `v_refacturacion_mensual`, `cerrar_periodo` (006/009/011/023) | join `subcategoria → categoria` | **Intactos** bajo D3 (la columna `categoria` de la vista pasa a mostrar el nombre del departamento por la sincronización) |
| `perfil.categoria_id` (001) | «categoría por defecto para tarifa y prefill» | **Sin uso en UI** (superviviente). Los valores no se tocan |
| `perfil.departamento_id` (002) | departamento del profesional | Se mantiene: «el profesional pertenece a un departamento, punto» |
| `empresa_departamento` | no existe | **Nueva** (M:N). Define qué departamentos EXISTEN en cada empresa |
| `perfil_departamento` | no existe | **Nueva**, opcional. Vacía = todos los de su empresa |
| `resumen_dia/mes` (010/019/021) | devuelven `departamento` (nombre) del perfil | Sin cambio de código; **cambian las cadenas** si se renombran departamentos |

### 1.2 Los filtros que existen hoy (lo que «muere»)

- **015 (departamento)** — `categoria.departamento_id` NULL = global; el empleado ve globales + las de su departamento; sin departamento ve todas.
- **026** — fix de datos (Diseño apuntaba a 3B3). Ya aplicado; no se repite.
- **v1.3 (`repartirTareas`, `lib/horas/tareas.ts`, punto único de los 4 puntos de imputación)** — con categoría propia: ve la suya + transversales y el resto tras **«Otras tareas…»**; sin categoría, cae al filtro de 015.
- Todo esto lo **sustituye** una única regla: *visibles = especialidades de los departamentos de **mi empresa**; si el admin ha fijado un conjunto en `perfil_departamento`, ese conjunto*. Ver §4 y las decisiones D5/D6.

### 1.3 Código de la app afectado (conteo de referencias a categoria/subcategoria/departamento/CATC)

| Área | Archivos (refs) |
|---|---|
| Selector de tareas (empleado y admin) | `lib/horas/tareas.ts` (20), `hooks/useCategoriasTareas.ts` (14), `SelectorTarea.tsx` (12), `ComposerLinea.tsx` (12), `NuevaImputacionSheet.tsx` (13), `PrecargadoEscritorio` (3), `ImputarEscritorio/Movil` (3+3), `ControlEscritorio.tsx` (20, imputación directa por persona destino), `EmpleadoApp.tsx` (11), `useImputacionesMes.ts` (11), `empleado/types.ts` (5), `app/debug/ImputacionTester` (13) |
| Usuarios | `UsuariosEscritorio.tsx` (43), `FichaUsuarioEscritorio.tsx` (16), `hooks/admin/useUsuarios.ts` (17), `lib/usuarios/{alta,edicion}.ts` (6+6), `api/export/usuarios` (5) |
| Secciones | `CategoriasEscritorio.tsx` (20) → **muere**; `DepartamentosEscritorio.tsx` (42) + `useDepartamentosAdmin.ts` (24) → **absorben**; `useCategorias.ts` (22), `useDepartamentos.ts` (12), `secciones.ts`, `ShellEscritorioAdmin`, `rutas.ts`, `types.ts`, 2 pages |
| Dinero/reportes | `TarifasEscritorio.tsx` (14), `useTarifas.ts` (7), `RefacturacionEscritorio.tsx`, `useRefacturacion.ts` (5), `api/export/refacturacion`, `FichaProyectoEscritorio.tsx` (11) + `useFichaProyecto.ts` (24: «Horas por especialidad»), `FichaEmpresaEscritorio.tsx` (3) |
| Colores (**CATC**) | `lib/horas/categorias.ts` `colorCategoria(nombre)` **por nombre** (4 nombres fijos) + `CatDot.tsx` (usado en 9 sitios) + **4 copias del mismo mapa** en `CategoriasEscritorio`, `FichaProyecto`, `Refacturacion`, `Tarifas` + variables `--cat-desarrollo/diseno/abogados/gestion` (claro y oscuro) en `globals.css` |
| Importadores | `lib/importadores/categorias.ts` (59), `usuarios.ts` (17), `empresas.ts`, `registro.ts`, `xlsx.ts`; exports `api/export/categorias`, `usuarios`, `refacturacion`; plantillas `api/plantillas/[tipo]` |
| Semillas | `supabase/seed.sql` (demo), `seed_datos.sql`, `seed-produccion.sql` (3 deptos / 4 categorías / 14 tareas) |

### 1.4 Datos vivos

**Demo (filas, solo lectura).**
- Departamentos: **Diseño** (0 personas), **3B3** (9 personas, con responsable), **Jurídico** (2 personas).
- Categorías (5): Desarrollo→3B3 (4 tareas, 778,5 h), Abogados→Jurídico (4 tareas, 222,5 h), Diseño→Diseño (3 tareas, 158 h), **Gestión→global** (3 tareas: Reuniones 102 h, Administración, RRHH), **Operaciones→global** (1 tarea «Móviles», 0 h; **solo existe en demo**).
- Personas por (departamento × categoría): 3B3×Desarrollo 8 · Jurídico×Abogados 2 · **3B3×Diseño 1 (Sara: incoherente)** · sin ninguno 2 (Málaga: Enrique, Marina).
- Por empresa: Wowinx 9 (todas 3B3) · Legal Norte 2 (Jurídico) · Málaga 2 (sin departamento).
- Tarifas (5): Diseño 55 €, Desarrollo 60 €, Abogados/Legal Norte 95 €, Gestión/Legal Norte 57,5 €, y una por empleado (Ana Ruiz 110 €). **Hay dinero real en la demo.**
- 141 imputaciones; 3 empresas × jul/ago con periodos cerrados.

**Producción (solo conteos).** 3 departamentos (activos) · 4 categorías (1 global = Gestión) · 14 tareas · **0 tarifas** · 7 perfiles (1 con categoría, 1 con departamento) · 3 empresas · 7 proyectos · 15 imputaciones (0 cerradas) · 0 periodos. Catálogo = `seed-produccion.sql` (mismos ids que la demo, sin «Operaciones»).

---

## 2. Mapa de fusión grupo → departamento

| Hoy | Destino | Notas |
|---|---|---|
| Diseño (dept) = Diseño (grupo) | **Diseño** | Ya enlazado (026). Sin cambios de nombre |
| Jurídico (dept) + Abogados (grupo) | **Legal** | Renombra el departamento; el espejo se sincroniza («Abogados» → «Legal») |
| 3B3 (dept) + Desarrollo (grupo) | **ver D1** | recomendación abajo |
| Gestión (global/transversal) | **Administración y Finanzas** (ver D2) | Nace como departamento presente en las 3 empresas |
| Operaciones (global, **solo demo**) | **Operaciones** | Está en tu lista predefinida; conserva «Móviles» |

**3B3 vs Desarrollo — pros/contras**

| | Conservar **3B3** | Renombrar a **Desarrollo** |
|---|---|---|
| A favor | 3B3 es el nombre vivo que usa la gente (aparece en `mapa`, tipologías, ejemplos de plantilla, correos); cero cambio en `resumen_*`; el color de Desarrollo se hereda igualmente | Coherente con la lista predefinida (Desarrollo, Diseño, Legal…); un departamento por función, no por marca interna; los nuevos entornos nacen con el nombre estándar |
| En contra | Rompe la regla «nombre = función» de la lista predefinida; «3B3» no explica nada a quien llega nuevo | Cambia las cadenas de `resumen_*` (huella); obliga a actualizar ejemplos/plantillas/mapa (`3B3` es un literal en seeds y plantillas); la gente lo llama 3B3 |
| Riesgo | bajo | medio-bajo (cosmético, pero visible) |

**Recomendación: renombrar a «Desarrollo»** si el criterio del modelo es «departamento = función»; conservar «3B3» solo si es una marca interna que debe mantenerse. Tu decisión (D1). Con cualquiera de las dos, el espejo y el color (el de «Desarrollo» actual) no cambian.

> Nota: las tareas de Gestión incluyen **RRHH** y **Administración**. Con «Administración y Finanzas» → especialidad «Administración» hay un choque de nombres, y «RRHH» apunta a tu departamento «Personas (RRHH)». Propuesta: dejar Reuniones/Administración/RRHH como están en la migración (cero movimiento de tareas) y que el admin las reubique después desde la UI.

---

## 3. Estrategia de migración (030 + 031)

### 3.1 Principios
- Ninguna fila de `imputacion`, `subcategoria` ni `tarifa` se modifica.
- Todo en una transacción por migración, con **autocomprobación final que revierte** si algo no cuadra (patrón 023/024/029), y **validación previa en copia emulada** de proyecto nuevo (lección 15).
- Datos dirigidos por **nombre + guardas** (el catálogo difiere entre demo y producción: «Operaciones»). La migración se **niega** a ejecutarse si la forma no es la esperada.
- RLS de las tablas nuevas, `REVOKE` a `anon`/`public`, `GRANT` explícito y `has_function_privilege` (normas K/L de la 023/024). **Congelación de seguridad**: no se abre nada más que lo necesario.

### 3.2 Migración 030 — ADITIVA (compatible con la app v1.7; desplegable antes)
1. `departamento.color text` (clave de paleta, D12), `NULL` permitido al principio.
2. `empresa_departamento (empresa_id, departamento_id, PK compuesta)` + RLS: lectura a todo `authenticated`; escritura solo admin_grupo (la edición de empresa ya es solo de admin_grupo).
3. `perfil_departamento (perfil_id, departamento_id, PK compuesta)` + RLS: lectura propia y de admins en su ámbito; escritura admin_grupo (y admin_empresa solo sobre no-admins de su empresa, D7).
4. Trigger de **sincronización del espejo**: al renombrar un departamento se renombra su categoría espejo; al crear un departamento se crea su espejo. Función `security definer` con `search_path` fijo y guarda de sesión (norma 023).
5. Nada cambia de comportamiento visible: la app v1.7 sigue igual.

### 3.3 Migración 031 — CONMUTACIÓN (se aplica justo antes de promocionar la app v2.0)
1. **Respaldo determinista**: tabla `respaldo_v20` con (departamento_id, nombre_anterior, color_anterior), (categoria_id, departamento_id_anterior), (perfil_id, departamento_id_anterior) de todo lo que se va a cambiar. Es lo que permite la reversa exacta.
2. **Renombres** de departamentos según D1/D2 (Jurídico→Legal; 3B3→Desarrollo si D1; etc.).
3. **Gestión**: crear el departamento «Administración y Finanzas» y enlazar la categoría Gestión (hoy `departamento_id NULL`). **Operaciones** (solo si existe): ídem.
4. **Invariante del espejo**: `categoria.departamento_id NOT NULL` + `UNIQUE`, tras comprobar que las 4 (5 en demo) están 1:1.
5. **Normalizar personas incoherentes**: en demo, Sara (3B3 × Diseño) pasa a departamento Diseño si D11 lo aprueba; en producción solo cambia lo que la comprobación declare (hoy los conteos dicen 1 perfil con categoría y 1 con departamento; no se ha comprobado si son el mismo ni si son coherentes, porque no se leen filas: lo comprobará la propia migración y abortará si hay incoherencia no declarada).
6. **`empresa_departamento` inicial = TODOS los departamentos en TODAS las empresas** (D4) → el comportamiento de cada persona **no cambia** el día de la promoción; el admin recorta después desde la UI. (Hoy las personas sin departamento ya ven todo; limitar por empresa de golpe dejaría a Málaga sin tareas.)
7. **Colores**: asigna la clave de paleta (los 4 actuales conservan **exactamente** sus valores; los nuevos, de la paleta).
8. **Autocomprobación**: conteos de `imputacion`/`subcategoria`/`tarifa` idénticos; ninguna `imputacion.subcategoria_id` huérfana; 1:1 espejo; todo perfil conserva su `departamento_id` salvo los declarados; `resolver_tarifa` devuelve lo mismo para un conjunto de casos sembrados (antes/después). Si falla cualquiera, `RAISE` y todo se revierte.

### 3.4 Cómo migran los datos de ambas bases
- **Demo**: aplicar 030 → verificar con la app v1.7 → aplicar 031 + app v2.0 → verificar → es el ensayo general.
- **Producción**: mismo orden, con **backup previo** (volcado de solo-datos de `departamento, categoria, subcategoria, perfil, tarifa, empresa` a un archivo local + conteos + SHA del pack) y ventana corta. Catálogo de producción = 3 departamentos / 4 categorías / 14 tareas, sin tarifas ni periodos: **riesgo de dato muy bajo**.
- **Compatibilidad de la ventana entre 031 y la app**: con 031 aplicada y la app v1.7 aún desplegada, **Gestión deja de ser «global»** (ahora tiene departamento) y la v1.7 la esconde a quien no sea de Administración (a quien tiene categoría propia le queda en «Otras tareas…»; a quien tiene departamento y no categoría se le oculta). Mitigación: **031 y la promoción de la app en la misma ventana** (minutos). Efecto en producción durante esa ventana: acotado a los pocos perfiles con categoría o departamento (hoy 1 y 1 según los conteos) y a las cuentas del pack sin ninguno (ven todo, sin cambio).

### 3.5 Plan de reversa en producción
1. **Antes de empezar**: backup + conteos + SHA del pack + huella enmascarada.
2. **Si falla la propia migración**: transacción + autocomprobación → no queda nada.
3. **Si falla después** (app o datos): `032_down` (escrita y **probada en la demo** antes de producción) que restaura nombres/enlaces desde `respaldo_v20`, quita el invariante UNIQUE, vacía `empresa_departamento`/`perfil_departamento`, y deja `departamento.color` en NULL. No toca imputaciones. Después, `git revert` del merge de la app y push (la app v1.7 funciona sobre el esquema restaurado y, durante el intervalo, también sobre el migrado salvo el matiz de Gestión).
4. **Orden seguro**: la 030 (aditiva) puede quedar puesta indefinidamente; la 031 es la única con reversa explícita.

---

## 4. Qué muere en app/UX y qué lo sustituye (pieza a pieza)

| Muere | Lo sustituye |
|---|---|
| Campo/columna **Especialidad** del usuario: tabla Usuarios, ficha, edición inline, invitación («Especialidad por defecto», «＋ Nueva especialidad» del Lote 4), `useUsuarios`/`edicion.ts`/`alta.ts`, columna en export e importador | Nada: el profesional **pertenece a un departamento, punto**. `perfil.categoria_id` queda **sin uso en UI** (superviviente, valores intactos) |
| Filtro v1.3 por categoría del profesional + **«Otras tareas…»** (hoja móvil, desplegable web) y el filtro por departamento de 015/026 (`repartirTareas` en 4 sitios + `ControlEscritorio`) | **Una regla**: especialidades de los departamentos de **su empresa** (`empresa_departamento`), o el conjunto fijado en `perfil_departamento`. Mismo punto único (`lib/horas/tareas.ts`), 4 puntos de imputación + imputación directa del admin por persona destino. «Otras tareas…» desaparece salvo que D5 decida lo contrario |
| Sección **Especialidades** (`CategoriasEscritorio`: crear categoría, crear subcategoría, importar/exportar) | Se **funde** en **/admin/departamentos**: listado de departamentos (color, nº especialidades, nº profesionales, **empresas donde existe**) → dentro, sus especialidades (alta/edición/baja). `/admin/especialidades` redirige a `/admin/departamentos` (como se hizo con categorías) |
| «Crear departamento» suelto | Alta con **lista predefinida** seleccionable (uno, varios o todos) + «nuevo»: Desarrollo, Diseño, Legal, Administración y Finanzas, Personas (RRHH), Marketing y Comunicación, Comercial, Operaciones, Deportivo, Dirección |
| Alta/edición de **empresa** sin departamentos | Selección de departamentos en alta y ficha de empresa (D4: por defecto todos); `FichaEmpresa` muestra los suyos |
| **Colores por nombre** (`colorCategoria`, 4 copias del mapa, `--cat-*`) | `colorDepartamento(dep)` único, desde `departamento.color`; `CatDot`, picker (agrupado **por departamento**), roscos, Tarifas, Refacturación y FichaProyecto lo consumen |
| Tarifas «por categoría», Refacturación «por categoría», FichaProyecto «Horas por especialidad (=categoría)» | Se nombran **por departamento** (los datos y las vistas son los mismos por el espejo) |
| Cabecera «Categoría/Especialidad» de la FichaEmpresa y de las tablas | Se retira o pasa a «Departamento» según el caso |

**Qué no cambia**: `imputacion` (la línea sigue siendo proyecto · especialidad); `resumen_*`, balances y FTE; permisos y RLS de perfil; guardas 021/022/028.

---

## 5. Importadores y plantillas

| Importador | Cambio | Compatibilidad |
|---|---|---|
| **Usuarios** | Desaparece la columna `especialidad` (y su alias `categoria`). `departamento` se mantiene y se valida contra los de **su empresa** (`empresa_departamento`) | **Plantilla vieja sigue importando**: `categoria`/`especialidad` pasan a `ignoradas` (como `activo`) y el informe avisa de que se ignora. El export deja de llevarla |
| **Especialidades/catálogo** (hoy `categoria · departamento · tarea`) | Se reorienta a **`departamento · especialidad`** (1 fila por especialidad); departamento debe existir (alta solo-nuevos, todo-o-nada, igual que hoy) | **Ruptura declarada** (recomendada, D8): la columna `categoria` antes era un *grupo* y su equivalencia con departamento es ambigua para filas globales. El analizador detecta la cabecera vieja (`categoria`+`tarea`) y devuelve un error claro que remite a la plantilla nueva. Nadie reimporta el export (daría solo duplicados) |
| **Empresas** | Columna opcional `departamentos` (lista separada por «;»). Vacía = todos los activos (D4) | Plantilla vieja sigue valiendo (columna opcional) |
| Proyectos, coste, vacaciones | Sin cambios | — |
| **Exports** | usuarios (sin especialidad), «departamentos-especialidades», refacturación (`departamento` en lugar de `categoria`) | — |

---

## 6. Riesgos y estimación de regresión

### 6.1 Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Dinero**: tocar `tarifa`/valoradas/`cerrar_periodo` | Evitado por el espejo (D3); se verifica con `resolver_tarifa` sembrada antes/después y con `v_refacturacion_mensual` idéntica salvo el nombre |
| R2 | **Visibilidad al imputar**: alguien deja de ver tareas que usaba | 031 enlaza todo con todo (D4); **prueba de conjuntos**: para cada perfil, conjunto de especialidades visibles antes (reglas v1.3/015) vs después (regla nueva) → idéntico el día de la promoción. Vista «¿qué ve este profesional?» en la ficha |
| R3 | **Caso que la regla no cubre** (el que pedías que te trajera) | Ver D6: profesional de una empresa que presta servicio en un departamento que su empresa no tiene (p. ej. Wowinx → Legal Norte). `perfil_departamento` solo «acota» según tu texto; propongo que sea el conjunto **exacto** (acotar o ampliar), con aviso en UI |
| R4 | **Ventana 031 ↔ app** (Gestión deja de ser global en la v1.7) | 031 y promoción en la misma ventana; efecto acotado en producción |
| R5 | **Cadenas con nombre**: los `resumen_*`, plantillas, ejemplos, mapa, `colorCategoria` y seeds contienen «3B3», «Jurídico», «Abogados», «Gestión» | Barrido por AST como en v1.7 + prueba de detector; seeds actualizadas |
| R6 | **Línea base**: renombrar departamentos cambia las huellas | Huella enmascarada (ver 6.2) |
| R7 | **Seguridad**: tablas y funciones nuevas | RLS + `REVOKE anon` + `has_function_privilege` + sondas con parámetros inválidos (norma C); sin abrir otros frentes |
| R8 | **Reutilizar día / precargado** con especialidades ya no visibles | La validación de «ya no estás asignado…» se extiende al nuevo filtro con mensaje claro |
| R9 | **Seeds/proyecto nuevo**: la validación en copia emulada | Se hace antes de tocar demo/producción |
| R10 | **Imputación server-side**: hoy el filtro es solo de UI; no lo endurezco en BD en v2.0 (cambiaría imputaciones legítimas cruzadas) | Decisión explícita; se puede añadir un trigger después |

### 6.2 Huellas y conteos esperados
- **Huella ANCLA actual**: `b908bdf7` (cruda `242545f6`, 71 claves). **Cambiará** solo en las claves que contienen el nombre del departamento (`resumen_mes_7/8`, `resumen_dia_*` de Cristian y, si aplica, de Marina). Aritmética (`imputado`, `requerido`, FTE, balances) **debe ser idéntica**.
- **Nueva herramienta**: `regresion-huella` con modo **enmascarado** (sustituye el nombre del departamento por su id). **Esa huella debe ser idéntica** antes/después. La huella normal tomará una **nueva línea base** tras 031 (renombres), explicada clave a clave.
- **Pack de producción** (`snap_prod`): `imputacion`, `ausencia`, `empleado_proyecto`, `ticket` del pack = idénticos (no se tocan).
- **Conteos esperados** (se confirman al ejecutar): demo `departamento` 3→5 (+Administración y Finanzas, +Operaciones) o 3→4 según D2; producción 3→4; `categoria`, `subcategoria`, `tarifa`, `imputacion`, `perfil`, `auth.users` **idénticos**; nuevas: `empresa_departamento` (demo 3×N, producción 3×4 = 12 si D4) y `perfil_departamento` 0.
- **Build/lint**: sin nuevos (objetivo 78 = 78).

---

## 7. Fases propuestas (cada una con su verificación y su punto de parada)

0. **Línea base** (demo + producción solo conteos): conteos, ANCLA normal y enmascarada, snapshot del **conjunto visible por perfil**, SHA del pack, backup de producción.
1. **030 aditiva** en demo → verificar con la app v1.7 (nada cambia) → (opcional) 030 en producción.
2. **031 + app v2.0 en demo**: sección fusionada, picker, usuarios sin especialidad, importadores, exports, colores, seeds. Verificación visual con captura en ambos temas y con control (detector), ciclo de departamentos/especialidades, conjuntos visibles idénticos, importadores con plantilla nueva y vieja, huellas.
3. **Ensayo de la reversa** (`032_down`) en demo.
4. **Promoción**: `comprobar-paridad` antes → backup → 030 (si no está) → 031 + merge `main → produccion` en la misma ventana → `comprobar-paridad` después → verificación post-deploy (pack intacto por conteos, login de prueba, imputar con una cuenta de prueba, `timerx-prod` en verde) → registro en el runbook.

**Tamaño**: 2 migraciones (+1 de reversa), ~45 archivos de app, 3 importadores + 3 exports + 3 seeds + docs, 1 pieza de diseño (paleta de 12 colores claro/oscuro). Es un lote grande; recomiendo **dos lotes con parada**: (a) DB + selector + usuarios + sección fusionada, (b) importadores/exports/colores finales.

---

## 8. Decisiones que necesito de ti

| # | Decisión | Mi recomendación |
|---|---|---|
| **D1** | 3B3 → ¿se queda «3B3» o pasa a «Desarrollo»? | Renombrar a **Desarrollo** (departamento = función) |
| **D2** | Nombre de Gestión: ¿«Administración» (tu fusión) o «Administración y Finanzas» (tu lista)? Y qué hacer con sus tareas Reuniones / Administración / RRHH | **«Administración y Finanzas»** (un solo nombre); tareas intactas en la migración y reubicación posterior por UI |
| **D3** | Modelo físico: **espejo 1:1** (cero cambios en dinero) vs **limpio** (columnas nuevas + reescribir tarifas/vistas/cierre) | **Espejo** ahora; limpieza opcional más adelante |
| **D4** | `empresa_departamento` inicial: todos los departamentos en todas las empresas | **Sí** (comportamiento idéntico el día 1) y el admin recorta |
| **D5** | ¿Se conserva «Otras tareas…» como atajo a todo el grupo? | **No** (lo sustituye empresa + `perfil_departamento`), pero ver D6 |
| **D6** | `perfil_departamento`: ¿**acota** (subconjunto de los de su empresa, como dices) o es el conjunto **exacto** (puede ampliar)? | **Exacto**, con aviso si incluye uno que su empresa no tiene (cubre el caso de servicio entre empresas) |
| **D7** | Quién edita `perfil_departamento`: ¿solo admin_grupo o también admin_empresa sobre no-admins de su empresa? | admin_grupo **y** admin_empresa en su ámbito (igual que 022) |
| **D8** | Plantilla vieja del catálogo: ¿ruptura declarada con error claro? | **Sí** |
| **D9** | Alta de departamento con lista predefinida: ¿también se elige en qué empresas existe? | Sí, en el mismo diálogo (por defecto todas) |
| **D10** | Despliegue: 030 días antes y 031 + app en la misma ventana | Sí |
| **D11** | Normalizar a Sara (3B3 × Diseño) → departamento Diseño en demo | Sí (dato de demo) |
| **D12** | Colores: clave de paleta (12 pares claro/oscuro, los 4 actuales intactos) vs hex libre | **Clave de paleta** (controla claro/oscuro y contraste) |
