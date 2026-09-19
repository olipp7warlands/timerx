# Lecciones activas (máx. 20)

1. **Verificación = login explícito por identidad, nunca la sesión del navegador.** Toda verificación arranca borrando las cookies `sb-*` y escribiendo la sesión de UNA identidad de la plantilla (magic link → cookie); se comprueba el email de la sesión antes de operar y se borran las cookies al terminar. Da igual que el navegador ya traiga la sesión del usuario (o de Haizea): no se usa y, si estorba, se sustituye. (Corrección del usuario, 2026-09-19.) Ojo: quitar el `#hash` de la URL no recarga la página; forzar una carga completa antes de mirar.
2. **Mutaciones desde caché pisan cambios ajenos.** Un `update` que reescribe todos los campos de una fila cacheada (edición inline) machaca lo que otro admin cambió entretanto. Las mutaciones compartidas escriben SOLO los campos presentes.
3. **`toISOString().slice(0,10)` sobre un `Date` local es un bug en Madrid** (devuelve el día anterior). Usar `src/lib/fechas.ts` (`hoyMadrid`, `sumarDias`, `ultimoDiaMes`); cálculo de calendario aritmético con `Date.UTC`.
4. **Una huella SHA cruda de RPCs puede cambiar sin cambiar los datos** (orden de filas empatadas tras un `UPDATE`). Compararla junto a la huella canónica (arrays ordenados). Regresión vigente: canónica `6c50f784`.
5. **Un cambio "de solo UI" que abre un formulario a un rol nuevo obliga a probar la RLS con intentos reales** (API directa), no solo lo que la UI deja hacer: así apareció que un admin_empresa puede subirse el rol a admin_grupo.
6. **`window.confirm` bloquea el navegador automatizado**: sustituirlo por un stub que registra el mensaje y devuelve true/false.
7. **Los `sed`/heredocs con barras invertidas o comillas en Git Bash se rompen**: escribir scripts con la herramienta Write y ejecutarlos.
