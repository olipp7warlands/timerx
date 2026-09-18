# TODO — Lote 1.5 (URLs) → Lote 3 (importadores)

> Orden fijado por el usuario: el Lote 1.5 va ANTES de cualquier rasgo nuevo (no estaba desplegado: `/admin/usuarios` → 404 en prod, `origin/main` == Lote 1).

## Lote 1.5 — Estructura de URLs

### Decisiones de diseño (cerradas)
- Catch-all opcional por lado: `src/app/[[...seccion]]/page.tsx` (empleado: `/inicio|/imputar|/calendario`, `/` → `/inicio`) y `src/app/admin/[[...seccion]]/page.tsx` (`/admin/<seccion>[/<id>]`, `/admin` → `/admin/inicio`). Mismo shell único; se borran `app/page.tsx` y `app/admin/page.tsx`.
- **Única fuente de verdad = URL** (`usePathname`/`useSearchParams`). `useState` de sección/pestaña/ficha desaparecen.
- **Desviación consciente de "navegar = router.push"**: se navega con `window.history.pushState/replaceState` (documentado en Next 16 como integrado con el router: sincroniza `usePathname`/`useSearchParams`, y `popstate` lo gestiona el router). Motivo: `router.push` a una página dinámica = viaje RSC + `getUser()` del middleware en CADA clic de pestaña/sección (latencia visible; hoy es instantáneo). El servidor sigue validando en carga fría/F5/enlace profundo. Se verifica atrás/adelante en navegador real.
- Fichas: ficha derivada de la URL; con datos cargando se espera (nunca redirigir al listado); solo tras cargar y sin el id → `replace` al listado + toast.
- Hand-offs efímeros (`?empleado=`, `?invitar=`): se consumen en un efecto y se limpian con `replaceState`.
- Deep-link sin sesión → `/login?next=<ruta+query>`; `next` validado como ruta interna (login y `/auth/callback`).
- Debug (`/debug/movil*`): modo aislado con estado local (solo dev, 404 en prod) para no romper su verificación visual.

### Pasos
- [ ] `src/lib/nav/`: `ruta-segura.ts`, `rutas.ts` (parse/build), `navegar.ts`
- [ ] Empleado: page catch-all + `EmpleadoApp` deriva `tab` de la URL
- [ ] Admin: page catch-all + `AdminApp` (contexto de navegación) + shells + secciones (usuarios/proyectos/empresas/control/inicio)
- [ ] Login/callback: `next` seguro; layout admin sin redirect que pierda el deep-link
- [ ] Build + lint sin regresión (82 problemas preexistentes)
- [ ] Verificación local (matriz a–g) en navegador real
- [ ] Commit + push + redeploy + matriz completa contra producción

## Lote 3 — Importadores (usuarios, coste/hora, vacaciones)
(Se detalla al cerrar el 1.5.)

## Revisión
(pendiente)
