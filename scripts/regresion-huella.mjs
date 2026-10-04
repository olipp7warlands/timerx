// Huella de regresión de la familia de RPCs de requeridas/balance/resumen. SOLO LECTURA, contra la BD de .env.local (demo).
// Uso: node scripts/regresion-huella.mjs [etiqueta]     (guarda <etiqueta>-ancla.json y <etiqueta>-viva.json en el directorio actual)
//
// Dos variantes, con papeles distintos:
//  · ANCLA  (jul/ago 2026: periodos CERRADOS en las 3 empresas, imputaciones inmutables, sin ausencias): inmune a `current_date`.
//           ES LA HUELLA DE REGRESIÓN ENTRE LOTES: si se mueve sin que cambien datos de jul/ago ni la familia de RPCs, es un bug.
//  · VIVA   (sep/oct 2026): informativa. Se mueve sola con el reloj (`estado_dias_mes` pasa días de `futuro` a `incompleto`) y con
//           cualquier prueba en demo; compararla clave a clave, no por hash.
// Sesiones REALES (magic link → verifyOtp) de Cristian (admin_grupo) y Marina (admin_empresa) + service_role. La huella canónica
// ordena los arrays (insensible al orden físico de las filas); la cruda no.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = {};
for (const l of readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, opciones);

async function comoUsuario(email) {
  const { data: l, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (e1) throw e1;
  const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opciones);
  const { data, error } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: l.properties.hashed_token });
  if (error) throw error;
  return createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { ...opciones, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}

const VARIANTES = {
  ancla: { meses: [7, 8], dias: ['2026-07-01', '2026-07-02', '2026-07-15', '2026-07-31', '2026-08-03', '2026-08-14', '2026-08-17', '2026-08-31'], faltantes: ['2026-07-01', '2026-08-31'], propio: 7 },
  viva: { meses: [9, 10], dias: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-14', '2026-09-18', '2026-10-12'], faltantes: ['2026-09-01', '2026-09-18'], propio: 9 },
};

const sesiones = {};
for (const [quien, email] of [['cris', 'cristian.haro@wowinx.com'], ['marina', 'marina.ortega@wowinx.com']]) sesiones[quien] = { c: await comoUsuario(email) };
for (const s of Object.values(sesiones)) s.perfiles = (await s.c.from('perfil').select('id,email').order('email')).data;

function canon(v) {
  if (Array.isArray(v)) return v.map(canon).map((x) => JSON.stringify(x)).sort().map((s) => JSON.parse(s));
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
}
const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 8);
const etiqueta = process.argv[2] ?? 'huella';

for (const [nombre, v] of Object.entries(VARIANTES)) {
  const snap = {};
  for (const [quien, { c, perfiles }] of Object.entries(sesiones)) {
    for (const m of v.meses) {
      snap[`${quien}.fte_mes_${m}`] = (await c.rpc('fte_mes', { p_anio: 2026, p_mes: m })).data;
      snap[`${quien}.estado_dias_mes_${m}`] = (await c.rpc('estado_dias_mes', { p_anio: 2026, p_mes: m })).data;
      snap[`${quien}.resumen_mes_${m}`] = (await c.rpc('resumen_mes', { p_anio: 2026, p_mes: m })).data;
      for (const p of perfiles) snap[`${quien}.balance_${p.email}_${m}`] = (await c.rpc('balance_mes_empleado', { p_empleado_id: p.id, p_anio: 2026, p_mes: m })).data;
    }
    for (const d of v.dias) snap[`${quien}.resumen_dia_${d}`] = (await c.rpc('resumen_dia', { p_fecha: d })).data;
    snap[`${quien}.faltantes`] = (await c.rpc('faltantes', { p_desde: v.faltantes[0], p_hasta: v.faltantes[1] })).data;
    snap[`${quien}.balance_mes_propio_${v.propio}`] = (await c.rpc('balance_mes', { p_anio: 2026, p_mes: v.propio })).data;
  }
  snap['svc.faltantes_recordatorio'] = (await admin.rpc('faltantes_recordatorio', { p_desde: v.faltantes[0], p_hasta: v.faltantes[1] })).data;
  const vacias = Object.entries(snap).filter(([, x]) => x == null).map(([k]) => k);
  writeFileSync(`${etiqueta}-${nombre}.json`, JSON.stringify(snap, null, 1));
  console.log(`${nombre.padEnd(5)} claves=${Object.keys(snap).length} cruda=${sha(snap)} canónica=${sha(canon(snap))}${nombre === 'ancla' ? '  ← HUELLA DE REGRESIÓN' : '  (informativa)'}${vacias.length ? `  ⚠ claves nulas: ${vacias.join(', ')}` : ''}`);
}
