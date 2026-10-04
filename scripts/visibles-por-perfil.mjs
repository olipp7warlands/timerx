// Conjunto de especialidades (subcategorías activas) que puede elegir cada perfil al imputar. SOLO LECTURA, BD de .env.local.
// Uso: node scripts/visibles-por-perfil.mjs <antes|despues> [salida.json]
//  · antes   = regla v1.3/015 (por categoría del perfil y departamento; con «Otras tareas…» todo es alcanzable si tiene categoría).
//  · despues = regla v2.0 (departamentos de su EMPRESA, o el conjunto exacto de perfil_departamento).
// `regresion` compara dos salidas: nadie puede ver MENOS después (D4/D5 de v2.0); quien ve más se lista.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const modo = process.argv[2];
const salida = process.argv[3];
if (!['antes', 'despues', 'comparar'].includes(modo)) {
  console.error('Uso: node scripts/visibles-por-perfil.mjs <antes|despues> [salida.json]  |  comparar antes.json despues.json');
  process.exit(1);
}
if (modo === 'comparar') {
  const a = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const d = JSON.parse(readFileSync(process.argv[4], 'utf8'));
  let menos = 0, mas = 0;
  for (const [email, antes] of Object.entries(a)) {
    const despues = new Set(d[email] ?? []);
    const pierde = antes.filter((x) => !despues.has(x));
    const gana = (d[email] ?? []).filter((x) => !antes.includes(x));
    if (pierde.length) { menos++; console.log(`  PIERDE ${email}: ${pierde.length} especialidades`); }
    if (gana.length) { mas++; console.log(`  gana   ${email}: +${gana.length}`); }
  }
  console.log(`perfiles: ${Object.keys(a).length} · ven MENOS: ${menos} · ven MÁS: ${mas}`);
  process.exit(menos ? 1 : 0);
}

const env = {};
for (const l of readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const tabla = async (t, sel) => (await admin.from(t).select(sel)).data ?? [];
const [subs, cats, perfiles] = await Promise.all([tabla('subcategoria', 'id, categoria_id, activa'), tabla('categoria', 'id, departamento_id'), tabla('perfil', 'id, email, empresa_id, departamento_id, categoria_id')]);
const depDeCat = new Map(cats.map((c) => [c.id, c.departamento_id]));
const activas = subs.filter((s) => s.activa);
const resultado = {};

if (modo === 'antes') {
  // Port literal de repartirTareas (v1.3): con categoría -> la suya + globales en `grupos`, el resto en `otras` (alcanzable); sin categoría -> globales + su departamento (o todo si no tiene).
  for (const p of perfiles) {
    const visibles = activas.filter((s) => {
      if (p.categoria_id) return true; // grupos ∪ otras
      const dep = depDeCat.get(s.categoria_id) ?? null;
      return p.departamento_id ? dep === null || dep === p.departamento_id : true;
    });
    resultado[p.email] = visibles.map((s) => s.id).sort();
  }
} else {
  const empDep = await tabla('empresa_departamento', 'empresa_id, departamento_id');
  const perDep = await tabla('perfil_departamento', 'perfil_id, departamento_id');
  for (const p of perfiles) {
    const propios = perDep.filter((x) => x.perfil_id === p.id).map((x) => x.departamento_id);
    const deps = new Set(propios.length ? propios : empDep.filter((x) => x.empresa_id === p.empresa_id).map((x) => x.departamento_id));
    resultado[p.email] = activas.filter((s) => deps.has(depDeCat.get(s.categoria_id))).map((s) => s.id).sort();
  }
}
if (salida) writeFileSync(salida, JSON.stringify(resultado, null, 1));
console.log(`${modo}: ${perfiles.length} perfiles · especialidades visibles por perfil: ` + Object.entries(resultado).map(([e, v]) => `${e.split('@')[0]}=${v.length}`).join(' '));
