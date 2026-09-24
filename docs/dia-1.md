# Día 1 en producción

> Referencia técnica completa: `docs/runbook-produccion.md` (ejecutado el 2026-09-22). Este documento es el resumen para ti: qué tienes, cómo entras y qué hacer primero. Sin claves ni contraseñas.

## Tu producción

- **URL**: https://timerx-prod-production.up.railway.app
- **Proyecto Supabase**: `horasgrupo-prod` (región París), plan Pro, con backups diarios automáticos (sin PITR, por decisión tuya: 13 personas, carga baja).
- **Tu cuenta**: `oliver.perez@wowinx.com`, rol admin_grupo, empresa Wowinx SL. La contraseña inicial es la que tú mismo diste; **cámbiala en tu primer login** (menú de tu avatar, arriba a la derecha → Cambiar contraseña).
- **Datos de partida**: las 3 empresas (Wowinx SL, Málaga CF SAD, Legal Norte SL), 3 departamentos, 4 categorías con 14 subcategorías, 6 áreas y 22 elementos del mapa del grupo, 7 proyectos, jornada 8/8/8/8/5,5/0/0 y los 8 festivos nacionales de 2026. Nada más: sin tarifas, sin asignaciones, sin imputaciones, sin ausencias, sin tickets. Tú eres la única cuenta.
- La **demo** (`timerx-production.up.railway.app`) sigue siendo tu herramienta comercial, sin tocar, con sus 13 cuentas.

## Checklist de día 1

- [ ] **Cambiar tu contraseña** en el primer login.
- [ ] **Fijar el CIF real de las 3 empresas**: Empresas → ficha de cada una → Editar datos. Se sembraron sin CIF (decisión tuya del 2026-09-22) porque no los dabas en el seed; la columna lo admite en blanco hasta que lo pongas.
- [ ] **Crear las cuentas reales del equipo** (a mano, una a una, o por el importador): alta con contraseña inicial que entregas en persona — no hay email configurado, así que nadie recibe invitación ni recuperación por correo.
- [ ] **Fijar las tarifas reales** de cada categoría/empresa (Ajustes → Tarifas) antes de que se use la refacturación intragrupo.
- [ ] **Revisar el calendario**: faltan los festivos de 2027 y los locales (p. ej. Málaga). Calendario → Festivos.
- [ ] **Revisar las jornadas por empresa**: hoy las tres tienen 8/8/8/8/5,5/0/0 igual; si alguna difiere de verdad, Ajustes → Jornada.
- [ ] **Primer mes en marcha**: deja correr el ciclo real (imputar → enviar → aprobar) antes de cerrar ningún periodo — un cierre es irreversible.
- [ ] **Rotar la contraseña de la base de datos** desde el panel de Supabase (Project Settings → Database). La que se generó al crear el proyecto la tienes en tu gestor; conviene que la cambies tú una vez entregado esto.

## Cómo promocionas cambios a producción

`main` es la demo (se despliega sola con cada push). Producción vive en la rama **`produccion`** y solo se mueve cuando tú lo decides:

1. Verifica el cambio en la demo (`main`) primero.
2. Desde el worktree `../TimerX-prod` (rama `produccion`): `git merge --no-ff main`.
3. `supabase db push --dry-run` — si hay migraciones nuevas, `supabase db push` antes de nada más.
4. `git push origin produccion` → Railway despliega `timerx-prod` solo.
5. Verifica: `/login` responde, el registro público sigue cerrado, el cron gemelo sigue en `0 8 * * *`.

Detalle completo, con el rollback, en `docs/runbook-produccion.md` §12.

## Dos cosas pendientes, sin prisa (backlog de seguridad)

No son urgentes ni exponen datos a nadie de fuera; quedan documentadas en `docs/seguridad-backlog.md`:

- **M** — un admin_empresa puede, hoy, asignar a uno de sus proyectos un empleado que en realidad pertenece a otra empresa del grupo. Requiere una cuenta admin_empresa de confianza (no un atacante externo); el efecto es mezclar facturación intragrupo, no acceso indebido a datos que esa cuenta no pudiera ya ver.
- **N** — si algún día activas el email (§11 del runbook), hay un fallo que romperá el enlace mágico y la recuperación de contraseña por correo (calcula mal la URL de vuelta detrás de Railway). Hoy no afecta a nada porque el acceso es por contraseña. Hay que arreglarlo antes de activar el correo, no antes.

## Si algo falla

- El cron de recordatorios (`timerx-prod-cron-recordatorios`) corre a las 08:00 UTC; hoy no envía nada (no hay email activo), solo registra. Si algún día lo activas, revisa antes `docs/runbook-produccion.md` §11.
- Nunca cierres un periodo hasta que confíes en los datos del mes: una imputación cerrada no se puede reabrir ni editar.
- Cualquier cambio de permisos o estructura entra por migración, nunca desde el panel de Supabase (evita que quede sin RLS o sin revisar).
