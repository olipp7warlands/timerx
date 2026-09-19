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
- **Mitigación**: **norma de proyecto** (todo entra por migración) + verificación periódica del runbook (§5): las dos consultas de catálogo
  devuelven 0 filas para `anon`.
- **Estado**: mitigado por proceso.

## Plantilla para entradas nuevas
```
### <ID> · <título corto>
- Qué: …            - Riesgo: …            - Propuesta: …            - Estado: abierto | mitigado | resuelto (migración/commit)
```
