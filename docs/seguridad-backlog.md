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

### I-residual · Una cuenta desactivada se bloquea en la APLICACIÓN, no en la API de datos
- **Qué**: `perfil.activo = false` hace que las páginas muestren «Cuenta desactivada» y que las acciones de servidor y las rutas API
  la traten como sin permisos (`getPerfilActivoServer`). RLS y la API de datos de Supabase no miran `activo`, y el JWT/refresh token de la cuenta
  sigue vigente: quien sepa llamar a la API con su sesión puede seguir leyendo lo que su rol ya le permitía.
- **Riesgo**: bajo (solo lo que su rol ya veía; sin escalada); relevante si «desactivar» se usa como baja laboral con datos sensibles.
- **Propuesta** (decisión pendiente, antes de datos reales): al desactivar, banear también la cuenta en Auth
  (`auth.admin.updateUserById(id, { ban_duration })` desde una acción de servidor con las mismas guardas que `errorRestablecer`) y revertirlo al reactivar;
  opcionalmente `activo` en las policies de lectura.
- **Estado**: abierto.

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
