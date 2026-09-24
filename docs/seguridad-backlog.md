# Backlog documentado de seguridad

> Referencia: `PLAN.md` → «MODELO DE PERMISOS COMPLETO» y «Migración 024 … CONGELACIÓN DE SEGURIDAD».
> **Regla de la congelación (desde la 024, 2026-09-19)**: el modelo de permisos está congelado. Un hallazgo **menor** se añade aquí
> (una entrada con contexto, riesgo, propuesta y estado) y **no** abre migración. Solo un hallazgo **crítico demostrable** —explotable con
> lo que tiene un atacante realista (la anon key pública o una cuenta de bajo privilegio) y con impacto real en datos de otros o
> escalada de privilegios— se trata como urgente. Todo cambio de permisos, aun autorizado, actualiza la matriz de `PLAN.md`
> (con su columna de verificación) en el mismo commit.

## Aceptado-documentado (decisión del usuario, 2026-09-19)

### F · Sin segregación de funciones
- **Qué**: un admin_empresa/admin_grupo puede aprobar sus propias imputaciones (`aprobar_imputaciones` no compara `auth.uid()` con
  `empleado_id`) y sus propias ausencias (`puede_resolver_ausencia`); un admin_empresa resuelve ausencias de admin_grupo que vivan en su empresa.
- **Por qué se acepta**: 13 personas, 3 empresas, admins de confianza; la traza queda en `imputacion.aprobado_por` y `ausencia.resuelta_por`.
- **Si cambia el contexto** (auditoría externa, crecimiento): una comprobación `auth.uid() <> empleado_id` en las RPC de aprobación
  (coste: dos funciones).

### G · Lecturas de admin_empresa más amplias que sus escrituras
- **Qué**: `ep_select` (todas las asignaciones del grupo) y `tarifa_select` (todas las tarifas) para admin_empresa.
- **Por qué se acepta**: necesarias para la refacturación intragrupo (comentarios en `useProyectosAsignados` y `useTarifas`).

### J · Categoría de los empleados editable por admin_empresa
- **Qué**: un admin_empresa cambia la categoría por defecto de los perfiles no-admin de su empresa (afecta a `resolver_tarifa` y, por tanto,
  a la valoración de la refacturación).
- **Por qué se acepta**: capacidad ya expuesta en la ficha y en la edición inline; la 022 la acota a perfiles no-admin de su empresa.

### M · `empleado_proyecto`: la policy de escritura acota por la empresa del PROYECTO, no la del EMPLEADO — **hallazgo de la Fase 4 (2026-09-22)**
- **Qué**: `ep_admin` (001) exige `empresa_de_proyecto(proyecto_id) = auth_empresa()` para un admin_empresa, pero no compara la empresa del
  `empleado_id`. Medido en producción: un admin_empresa de Wowinx pudo `upsert` una asignación de un empleado de **Málaga CF SAD** a un
  proyecto de **Wowinx**, sin error. Ese empleado podría entonces imputar horas (el trigger `imputacion_validar` solo comprueba que exista la
  fila en `empleado_proyecto`, no la empresa) en un proyecto ajeno a la suya, mezclando facturación intragrupo entre empresas.
- **Riesgo**: requiere una cuenta admin_empresa (privilegiada, de confianza), no `anon` ni escalada de privilegios; el impacto es de
  mezcla/trazabilidad de datos de refacturación, no de acceso indebido a datos de otro que la cuenta no pudiera ya leer (G).
- **Propuesta** (sin migración urgente): añadir `and empresa_de_perfil(empleado_id) = auth_empresa()` al `USING`/`WITH CHECK` de `ep_admin`
  (falta una función `empresa_de_perfil`, análoga a `empresa_de_proyecto`).
- **Estado**: abierto (backlog).

### N · `/auth/callback` calcula mal el origen detrás de Railway — **hallazgo de la Fase 4 (2026-09-22), NO es un hallazgo de seguridad**
- **Qué**: `src/app/auth/callback/route.ts` usa `new URL(request.url).origin`, que en Railway (demo Y producción, confirmado con `curl -I` en
  las dos) resuelve a `https://localhost:8080` en vez del dominio público. Un flujo que dependa de ese callback (magic link, recuperación de
  contraseña por email, OAuth) termina en `https://localhost:8080/login?error=auth#access_token=…` — el fragmento con el token llega
  intacto (lo conserva el navegador al no haber fragmento en la redirección nueva), pero la página no carga.
- **Por qué no es urgente ahora mismo**: con la decisión «sin email» (`MODO_EMAIL=log`, login por contraseña, sin invitaciones ni
  recuperación por correo) esta ruta está **dormida**: nadie la usa hoy. Es preexistente a este runbook y afecta a la demo igual que a
  producción; no lo introdujo la Fase 2/3/4.
- **Impacto si se activa email** (§11 del runbook) sin arreglarlo antes: magic link y «¿olvidaste tu contraseña?» dejarían de funcionar en
  producción y en la demo.
- **Propuesta**: leer el host público desde las cabeceras que Railway reenvía (`x-forwarded-host`/`x-forwarded-proto`) en vez de
  `request.url`, o fijar `APP_URL` como origen explícito en ese route handler.
- **Estado**: abierto (backlog); **bloquea** activar email (§11) hasta corregirse.

## Límites conocidos de lo ya implementado

### I-residual · Una cuenta desactivada se bloqueaba en la APLICACIÓN, no en la API de datos — **RESUELTO (Paso 0, migración 025)**
- **Antes**: `perfil.activo = false` solo bloqueaba páginas y acciones de servidor; el JWT vigente seguía leyendo en la API de datos.
- **Ahora**: `desactivarUsuario` (server action con service_role y `permisos.ts`) hace `activo = false` + ban de Auth; el **pre-request de la 025** rechaza en el acto (403 `PT403`) las peticiones de cualquier JWT ya emitido de una cuenta desactivada (medido: el ban por sí solo NO revocaba el JWT). Reactivar = unban + `activo = true`. Verificado con la demo desplegada. Ver `PLAN.md` («Producción — preparación») y `docs/runbook-produccion.md` §3.

### I-menor · `perfil.activo` sigue siendo escribible por API para un admin_empresa sobre los perfiles no-admin de su empresa
- **Qué**: `perfil_update_admin` (022) deja actualizar `activo` sin pasar por la server action, así que por API un AE podría poner `activo = false` en uno de los suyos **sin ban** (el pre-request de la 025 lo bloquea igualmente en la API y las páginas; solo faltaría el ban de Auth) o `activo = true` en una cuenta baneada (sigue baneada). Sin escalada ni acceso indebido.
- **Propuesta** (menor, sin migración urgente): privilegio por columna que excluya `activo` del UPDATE de `authenticated` (requiere rehacer el grant de tabla de `perfil` como grants por columna).
- **Estado**: abierto (backlog).

### L · Objetos creados desde el panel de Supabase nacen abiertos a `anon`
- **Qué**: el ACL por defecto de `supabase_admin` (panel, extensiones) concede privilegios a `anon`, `authenticated` y `service_role`; el rol de
  migración no puede alterarlo (la 024 lo intentó). El de `postgres` (migraciones) sí está cerrado.
- **Mitigación**: **norma de proyecto** (todo entra por migración) + verificación periódica del runbook (§9): las dos consultas de catálogo
  devuelven 0 filas para `anon`.
- **Estado**: mitigado por proceso.

## Plantilla para entradas nuevas
```
### <ID> · <título corto>
- Qué: …            - Riesgo: …            - Propuesta: …            - Estado: abierto | mitigado | resuelto (migración/commit)
```
