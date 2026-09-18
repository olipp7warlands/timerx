# TODO — Lote 1.5 (URLs) → Lote 3 (importadores)

> Orden fijado por el usuario: el Lote 1.5 va ANTES de cualquier rasgo nuevo (no estaba desplegado: `/admin/usuarios` → 404 en prod, `origin/main` == Lote 1).

## Lote 1.5 — Estructura de URLs — HECHO (commit 9adb75f, desplegado, matriz repetida en producción)
- [x] `src/lib/nav/` (rutas, navegar, ruta-segura) · catch-all empleado y admin · `NavAdmin` (contexto) · `EmpleadoApp` deriva la pestaña de la URL
- [x] Guardas (ficha cargando ≠ redirigir), segmentos desconocidos → base, deep-link sin sesión → `/login?next=`, `next` validado (login y callback)
- [x] Hallazgo: bfcache restauraba la pantalla del usuario anterior tras logout → `GuardaBfcache`
- [x] Matriz a–g en local (navegador real) y en producción
- Pendiente de verificar por el usuario: login real con `?next=` (exige teclear contraseña) y gesto atrás de un Android real

## Lote 3 — Importadores (usuarios, coste/hora, vacaciones)
- [x] Migraciones 016 (coste_empleado, v_coste_vigente) y 017 (importar_ausencias) aplicadas y pusheadas (d73d16d)
- [x] Patrón común `src/lib/importadores/` + UI `ImportadorBloque` + rutas plantillas/export
- [x] Usuarios (alta compartida con `invitarUsuario`), coste/hora (+ ficha admin_grupo), vacaciones (RPC transaccional)
- [x] Verificación local completa (ver PLAN.md): round-trip, error cazado, reversión, RLS Cristian/Marina, regresión byte-idéntica
- [x] Commit + push + redeploy (f28d9a1) + ciclo completo contra producción con reversión y conteos antes/después (idénticos)

## Revisión
- Línea base (antes de tocar datos): `scratchpad/base_conteos.txt` y `snap_base` (sha256 756660c9…). Tras cada prueba se compara.
- Decisión a revisar por el usuario: el importador de usuarios respeta `MODO_EMAIL` (demo = sin contraseña ni correo); `invitarUsuario` manual sigue invitando por email.
