#!/usr/bin/env node
// RESET DE ESTRENO de producción (docs/runbook-produccion.md §14). Mismo proyecto Supabase y mismo servicio Railway (ref, claves y variables se CONSERVAN):
// se borra TODA la BD, se reconstruye con las migraciones del repo + seed-produccion.sql y se recrea la cuenta admin.
//
//   node scripts/reset-estreno.mjs <fase> --env=<archivo .env de PRODUCCIÓN, fuera del repo> [opciones]
//   fases (en este orden):  pre · promocion · bd · auth · superficie · bootstrap · verificacion · cierre      ( `todo` = todas, con parada entre fases )
//
// SEGURIDAD
//  · Contra PRODUCCIÓN pide DOBLE confirmación al arrancar (frase «BORRAR PRODUCCION» y el ref del proyecto); sin TTY solo se admite con
//    --confirmo1 y --confirmo2 exactos (la orden literal del propietario: «ejecuta el reset»).
//  · Sin --ensayo solo acepta el proyecto de producción; con --ensayo solo la DEMO y NUNCA ejecuta las fases destructivas (promocion, bd, bootstrap).
//  · Las fases se ejecutan en orden: cada una exige la anterior en el archivo de estado (reset-estreno.estado.json, no versionado).
//  · Fase `bd`: `supabase db reset --linked` BORRA public + auth.* + historial. `--no-seed` NO se usa: la semilla es seed-produccion.sql vía [db.seed]
//    temporal en config.toml (revertido con git checkout SIEMPRE). Sin ese bloque el CLI cargaría seed.sql = la semilla de la DEMO.
//
// ENSAYO (demo, sin tocar su estructura): node scripts/reset-estreno.mjs <pre|auth|superficie|verificacion|cierre> --env=.env.local --ensayo --admin-email=cristian.haro@wowinx.com
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REF_PROD = 'duksjzgoipwwrjvvgzon';
const REF_DEMO = 'klmtskdbewukffuziusg';
const APP = { [REF_PROD]: 'https://timerx-prod-production.up.railway.app', [REF_DEMO]: 'https://timerx-production.up.railway.app' };
const FASES = ['pre', 'promocion', 'bd', 'auth', 'superficie', 'bootstrap', 'verificacion', 'cierre'];
const SOLO_PROD = ['promocion', 'bd', 'bootstrap'];
const FRASE_1 = 'BORRAR PRODUCCION';

// IDs estables de la semilla (supabase/seed-produccion.sql)
const EMPRESA_WOWINX = '00000000-0000-0000-0000-000000000001';
const DEP_DESARROLLO = '00000000-0000-0000-0004-000000000001';
const PROYECTO_XIM = '00000000-0000-0000-0003-000000000001';
const SUBCAT_BACKEND = '00000000-0000-0000-0002-000000000001';

// Contenido que DEBE tener producción tras la semilla (todo lo demás: 0)
const SEED = {
  empresa: 3, departamento: 4, categoria: 4, subcategoria: 14, empresa_departamento: 12, mapa_area: 6, mapa_item: 22, proyecto: 7,
  empresa_jornada: 21, festivo: 8, ajuste: 6,
};
// Censo v2.0 de la BD (scripts/sql/censo.sql), medido en la demo y reconstruido desde cero en una transacción abortada (idéntico)
const CENSO = {
  tablas: '25', vistas: '4', secuencias: '1', funciones: '60', funciones_de_trigger: '12', triggers: '11', policies: '50', indices: '52', pk: '23', fk: '42',
  check: '17', unique: '13', enums: '7', rls_activa: '25', pre_request: 'public.cuenta_desactivada_pre_request', anon_con_execute: '0', anon_con_privilegios_de_relacion: '0',
  v20_tablas_nuevas_con_rls: '3', v20_anon_en_tablas_nuevas: '0', v20_authenticated_lee_respaldo: 'f', v20_espejo_ejecutable_por_anon_o_authenticated: 'f',
  v20_trigger_espejo: 't', v20_categoria_departamento_not_null_unique: 't', v20_departamento_color_check: 't',
};

// ---------------------------------------------------------------------------------------------------------------- utilidades
const args = Object.fromEntries(process.argv.slice(3).map((a) => (a.startsWith('--') ? [a.slice(2).split('=')[0], a.includes('=') ? a.slice(a.indexOf('=') + 1) : true] : [a, true])));
const fase = process.argv[2];
const log = (m = '') => console.log(m);
const ok = (m) => console.log('  ✔ ' + m);
const aviso = (m) => console.log('  ⚠ ' + m);
class Fallo extends Error {}
const fallo = (m) => { throw new Fallo(m); };
const cmd = (c, a, o = {}) => spawnSync(c, a, { encoding: 'utf8', shell: false, ...o });
// El CLI de supabase en Windows puede ser un .exe sin extensión que solo resuelve Git Bash: se lanza por bash si falla el directo.
function supabase(a, o = {}) {
  let r = cmd('supabase', a, o);
  if (r.error?.code === 'ENOENT') r = cmd('bash', ['-c', 'supabase ' + a.map((x) => `'${x}'`).join(' ')], o);
  return r;
}
async function preguntar(texto) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(texto)).trim(); } finally { rl.close(); }
}
async function pausa(texto) {
  if (args['sin-parada'] || !process.stdin.isTTY) { log(`  (${texto})`); return; }
  await preguntar(`\n⏸  ${texto} — Enter para continuar, Ctrl+C para parar `);
}

function cargarEnv(ruta) {
  if (typeof ruta !== 'string') fallo('Falta --env=<archivo .env> (las claves de producción viven FUERA del repo).');
  if (!existsSync(ruta)) fallo(`No existe ${ruta}`);
  const env = {};
  for (const l of readFileSync(ruta, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
  for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env[k]) fallo(`Falta ${k} en ${ruta}`);
  return env;
}

function estadoArchivo() { return join(RAIZ, args.ensayo ? 'reset-estreno.estado.ensayo.json' : 'reset-estreno.estado.json'); }
const leerEstado = () => (existsSync(estadoArchivo()) ? JSON.parse(readFileSync(estadoArchivo(), 'utf8')) : { fases: {} });
const marcar = (f) => { const e = leerEstado(); e.fases[f] = { ok: true, en: new Date().toISOString() }; writeFileSync(estadoArchivo(), JSON.stringify(e, null, 1)); };

function worktreeProduccion() {
  const bloques = cmd('git', ['worktree', 'list', '--porcelain'], { cwd: RAIZ }).stdout.split(/\r?\n\r?\n/);
  for (const b of bloques) if (b.includes('branch refs/heads/produccion')) return b.match(/^worktree (.+)$/m)?.[1];
  return null;
}

// ---------------------------------------------------------------------------------------------------------------- contexto
async function contexto() {
  if (!FASES.includes(fase) && fase !== 'todo') fallo(`Fase desconocida «${fase ?? ''}». Fases: ${FASES.join(' · ')} · todo`);
  const env = cargarEnv(args.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = new URL(url).hostname.split('.')[0];
  const ensayo = !!args.ensayo;
  if (ref === REF_PROD && ensayo) fallo('--ensayo es solo para la DEMO: este .env apunta a PRODUCCIÓN.');
  if (ref === REF_DEMO && !ensayo) fallo('Este .env apunta a la DEMO: sin --ensayo solo se acepta producción. (La demo NO se resetea nunca.)');
  if (ref !== REF_PROD && ref !== REF_DEMO) fallo(`Proyecto desconocido (${ref}).`);
  const lista = fase === 'todo' ? FASES : [fase];
  if (ensayo && lista.some((f) => SOLO_PROD.includes(f))) fallo(`En --ensayo no se ejecutan las fases destructivas (${SOLO_PROD.join(', ')}).`);
  const wt = ref === REF_PROD ? worktreeProduccion() : RAIZ;
  if (!wt) fallo('No encuentro el worktree de la rama `produccion` (git worktree list).');
  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    env, url, ref, ensayo, wt, app: APP[ref], lista,
    admin: createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, opciones),
    anon: createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opciones),
    opciones,
  };
}

async function puertaProduccion(ctx) {
  if (ctx.ref !== REF_PROD) return;
  log('\n' + '█'.repeat(78));
  log('  VAS A BORRAR TODA LA BD DE PRODUCCIÓN (proyecto ' + ctx.ref + ').');
  log('  Mueren: todas las cuentas (auth), perfiles, imputaciones, ausencias, tickets, tarifas,');
  log('  el pack de revisión y todos los datos de prueba. Se conservan: el proyecto, sus claves y Railway.');
  log('█'.repeat(78));
  const c1 = typeof args.confirmo1 === 'string' ? args.confirmo1 : await preguntar(`\nConfirmación 1/2 — escribe exactamente «${FRASE_1}»: `);
  if (c1 !== FRASE_1) fallo('Confirmación 1 incorrecta. No se hace nada.');
  const c2 = typeof args.confirmo2 === 'string' ? args.confirmo2 : await preguntar(`Confirmación 2/2 — escribe el ref del proyecto (${ctx.ref}): `);
  if (c2 !== ctx.ref) fallo('Confirmación 2 incorrecta. No se hace nada.');
  ok('doble confirmación recibida');
}

// ---------------------------------------------------------------------------------------------------------------- helpers de datos
async function tablasExpuestas(ctx) {
  const r = await fetch(`${ctx.url}/rest/v1/`, { headers: { apikey: ctx.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ctx.env.SUPABASE_SERVICE_ROLE_KEY}` } });
  const oa = await r.json();
  const rutas = Object.keys(oa.paths ?? {}).filter((p) => p !== '/');
  return { oa, relaciones: rutas.filter((p) => !p.startsWith('/rpc/')).map((p) => p.slice(1)), rpcs: rutas.filter((p) => p.startsWith('/rpc/')).map((p) => p.slice(5)) };
}
/** Tras un DDL masivo PostgREST tarda unos segundos en recargar su caché de esquema: se espera a que liste el modelo completo. */
async function esperarApi(ctx, minimo = 25) {
  for (let i = 0; i < 24; i++) {
    try { const { relaciones } = await tablasExpuestas(ctx); if (relaciones.length >= minimo) return; } catch { /* aún recargando */ }
    await new Promise((r) => setTimeout(r, 5000));
  }
  fallo(`La API no lista el esquema esperado (≥ ${minimo} relaciones) tras 2 minutos: ¿falló el reset?`);
}
/** Cuerpo INOCUO de una RPC (norma C): los nombres REALES de sus argumentos (del OpenAPI) con valores que fallan también para el rol autorizado. */
function cuerpoInocuo(oa, fn) {
  const props = oa.paths?.[`/rpc/${fn}`]?.post?.parameters?.find((x) => x.in === 'body')?.schema?.properties ?? {};
  const NULO = '00000000-0000-0000-0000-00000000dead';
  return Object.fromEntries(Object.entries(props).map(([k, v]) => {
    const t = v.type, f = v.format ?? '';
    if (t === 'integer') return [k, 13];
    if (t === 'number') return [k, 0];
    if (t === 'boolean') return [k, false];
    if (t === 'array') return [k, []];
    if (t === 'object') return [k, {}];
    if (f === 'uuid') return [k, NULO];
    if (f === 'date') return [k, '2000-01-01'];
    if (/json/.test(f)) return [k, []];
    return [k, ''];
  }));
}
async function contar(ctx, tablas) {
  const out = {};
  for (const t of tablas) { const r = await ctx.admin.from(t).select('*', { count: 'exact', head: true }); out[t] = r.error ? `ERR:${r.error.code}` : r.count; }
  out['auth.users'] = await contarUsuarios(ctx);
  return out;
}
async function listarUsuarios(ctx) {
  const todos = [];
  for (let page = 1; ; page++) {
    const { data, error } = await ctx.admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fallo('No se pueden listar los usuarios de Auth: ' + error.message);
    todos.push(...data.users);
    if (data.users.length < 200) break;
  }
  return todos;
}
const contarUsuarios = async (ctx) => (await listarUsuarios(ctx)).length;
async function sesionDe(ctx, email) {
  const { data: l, error: e1 } = await ctx.admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (e1) fallo(`No se pudo generar el acceso de ${email}: ${e1.message}`);
  const c = createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ctx.opciones);
  const { data, error } = await c.auth.verifyOtp({ type: 'magiclink', token_hash: l.properties.hashed_token });
  if (error) fallo(`Login explícito de ${email} fallido: ${error.message}`);
  if (data.user.email?.toLowerCase() !== email.toLowerCase()) fallo(`La sesión no es de ${email}`);
  return { token: data.session.access_token, id: data.user.id, cliente: createClient(ctx.url, ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { ...ctx.opciones, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } }) };
}

// ---------------------------------------------------------------------------------------------------------------- FASES
const fases = {
  // ------------------------------------------------------------------------------------------------ a) PRE-VUELO
  async pre(ctx) {
    log('\n== PRE-VUELO ==');
    const par = cmd('node', [join(RAIZ, 'scripts/comprobar-paridad.mjs')], { cwd: RAIZ });
    log(par.stdout.split('\n').map((l) => '    ' + l).join('\n'));
    if (par.status !== 0 || /DIVERGENCIA/.test(par.stdout)) fallo('comprobar-paridad: DIVERGENCIA. Se resuelve antes de seguir.');
    ok('paridad demo ↔ producción sin divergencia');

    const { relaciones } = await tablasExpuestas(ctx);
    const conteos = await contar(ctx, relaciones);
    log('\n  Conteos completos (lo que existe HOY):');
    for (const [t, n] of Object.entries(conteos)) if (n) log(`    ${t.padEnd(26)} ${n}`);
    const usuarios = await listarUsuarios(ctx);
    log(`\n  Cuentas de Auth que MUEREN (${usuarios.length}): ` + usuarios.map((u) => u.email).sort().join(', '));

    const dir = join(RAIZ, 'backups-reset', new Date().toISOString().replace(/[:.]/g, '-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'conteos.json'), JSON.stringify(conteos, null, 1));
    for (const t of relaciones) {
      const filas = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await ctx.admin.from(t).select('*').range(desde, desde + 999);
        if (error) { aviso(`export de ${t}: ${error.message}`); break; }
        filas.push(...data);
        if (data.length < 1000) break;
      }
      writeFileSync(join(dir, `${t}.json`), JSON.stringify(filas));
    }
    writeFileSync(join(dir, 'auth_users.json'), JSON.stringify(usuarios.map((u) => ({ id: u.id, email: u.email, creado: u.created_at, ultimo_acceso: u.last_sign_in_at, metadata: u.user_metadata })), null, 1));
    ok(`export previo escrito en ${dir} (fuera de git; seguro barato aunque todo sea prueba)`);

    const ligado = existsSync(join(ctx.wt, 'supabase/.temp/project-ref')) ? readFileSync(join(ctx.wt, 'supabase/.temp/project-ref'), 'utf8').trim() : null;
    if (ligado !== ctx.ref) fallo(`El worktree ${ctx.wt} no está enlazado a ${ctx.ref} (enlazado: ${ligado}). Se enlaza desde el worktree de produccion, nunca desde la carpeta principal.`);
    ok('CLI enlazado al proyecto correcto');
    const bk = supabase(['backups', 'list', '--project-ref', ctx.ref, '-o', 'json'], { cwd: ctx.wt });
    try { const b = JSON.parse(bk.stdout).backups ?? []; ok(`backups físicos de Supabase: ${b.length}; último ${b[0]?.status ?? '?'} ${b[0]?.inserted_at ?? ''}`); } catch { aviso('no se pudo leer `supabase backups list` (revísalo en el panel)'); }
  },

  // ------------------------------------------------------------------------------------------------ b) PROMOCIÓN
  async promocion(ctx) {
    log('\n== PROMOCIÓN main → produccion ==');
    const g = (a) => cmd('git', a, { cwd: ctx.wt });
    if (g(['status', '--porcelain']).stdout.trim()) fallo('El worktree de produccion tiene cambios sin commitear.');
    if (g(['branch', '--show-current']).stdout.trim() !== 'produccion') fallo('El worktree no está en la rama produccion.');
    g(['fetch', 'origin']);
    const main = g(['rev-parse', 'origin/main']).stdout.trim();
    log(`  origin/main = ${main.slice(0, 7)}`);
    const m = g(['merge', '--no-ff', '--no-commit', 'origin/main']);
    if (/Already up to date/i.test(m.stdout)) ok('produccion ya contiene origin/main');
    else {
      const conflictos = g(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
      if (m.status !== 0 && conflictos.length === 0) { g(['merge', '--abort']); fallo('git merge falló sin conflictos: ' + (m.stderr || m.stdout)); }
      const otros = conflictos.filter((f) => f !== 'supabase/config.toml');
      if (otros.length) { g(['merge', '--abort']); fallo(`Conflictos fuera de config.toml (${otros.join(', ')}): merge abortado, resolverlo a mano.`); }
      if (conflictos.includes('supabase/config.toml')) { g(['checkout', '--ours', '--', 'supabase/config.toml']); g(['add', 'supabase/config.toml']); ok('config.toml: gana el de producción'); }
      const msg = `Promocion: v2.0 (main ${main.slice(0, 7)}) a produccion\n\nMerge siguiendo runbook-produccion.md §12/§14 (reset de estreno). config.toml se conserva el de produccion.` + (args.coautor ? '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>' : '');
      const c = g(['commit', '-m', msg]);
      if (c.status !== 0) fallo('git commit del merge falló: ' + c.stderr);
    }
    const dif = g(['diff', '--name-only', 'origin/main', 'HEAD']).stdout.split('\n').filter(Boolean).filter((f) => !['supabase/config.toml', 'supabase/seed-produccion.sql'].includes(f));
    if (dif.length) fallo(`produccion difiere de main fuera de los archivos propios: ${dif.join(', ')}`);
    ok('árbol de produccion == main salvo archivos propios');
    const sha = g(['rev-parse', 'HEAD']).stdout.trim();
    await pausa(`Se va a EMPUJAR ${sha.slice(0, 7)} a la rama produccion (dispara el despliegue de timerx-prod)`);
    const p = g(['push', 'origin', 'produccion']);
    if (p.status !== 0) fallo('git push falló: ' + p.stderr);
    ok(`push de ${sha.slice(0, 7)}; esperando el despliegue de timerx-prod…`);
    for (let i = 0; i < 60; i++) {
      try { const v = await (await fetch(`${ctx.app}/api/version`, { headers: { accept: 'application/json' } })).json(); if (v.commit === sha) { ok(`/api/version de timerx-prod = ${sha.slice(0, 7)} (${v.rama})`); return; } } catch { /* despliegue en curso */ }
      await new Promise((r) => setTimeout(r, 15000));
    }
    fallo('timerx-prod no llegó a servir el SHA nuevo en 15 min: revisa Railway (list-deployments / get-logs).');
  },

  // ------------------------------------------------------------------------------------------------ c) RESET DE BD
  async bd(ctx) {
    log('\n== RESET DE BD (base limpia + migraciones + seed-produccion.sql) ==');
    const cfg = join(ctx.wt, 'supabase/config.toml');
    const original = readFileSync(cfg, 'utf8');
    if (/\[db\.seed\]/.test(original)) fallo('config.toml ya declara [db.seed]: revisa a mano antes de seguir (el guion lo añade y lo revierte).');
    if (!existsSync(join(ctx.wt, 'supabase/seed-produccion.sql'))) fallo('Falta supabase/seed-produccion.sql en el worktree de produccion.');
    await pausa('ÚLTIMA PARADA: `supabase db reset --linked` BORRARÁ public + auth + historial de producción y reconstruirá desde el repo');
    writeFileSync(cfg, original + '\n[db.seed]\nenabled = true\nsql_paths = ["./seed-produccion.sql"]\n');
    let r;
    try {
      r = supabase(['db', 'reset', '--linked', '--yes'], { cwd: ctx.wt, stdio: 'inherit' });
    } finally {
      cmd('git', ['checkout', '--', 'supabase/config.toml'], { cwd: ctx.wt });
    }
    if (cmd('git', ['status', '--porcelain'], { cwd: ctx.wt }).stdout.trim()) aviso('el worktree quedó con cambios: ' + cmd('git', ['status', '--short'], { cwd: ctx.wt }).stdout);
    if (r.status !== 0) fallo('`supabase db reset --linked` falló: la BD puede haber quedado A MEDIAS. Se repite la fase `bd` (es idempotente: vuelve a vaciar y reconstruir); el export previo está en backups-reset/.');
    ok('db reset terminado (config.toml revertido)');

    // Historial: migraciones del repo (001-031 sin la 003 = 30) aplicadas y solo esas
    const locales = readdirSync(join(ctx.wt, 'supabase/migrations')).filter((f) => /^\d{3}_.*\.sql$/.test(f)).map((f) => f.slice(0, 3));
    const ml = supabase(['migration', 'list'], { cwd: ctx.wt });
    const remotas = [];
    for (const l of ml.stdout.split(/\r?\n/)) { const m = l.match(/^\s*(\d+)?\s*\|\s*(\d+)?\s*\|/); if (m?.[2]) remotas.push(m[2]); }
    const faltan = locales.filter((v) => !remotas.includes(v)); const sobran = remotas.filter((v) => !locales.includes(v));
    if (faltan.length || sobran.length) fallo(`Historial de migraciones: faltan ${faltan.join(',') || '—'} · sobran ${sobran.join(',') || '—'}`);
    ok(`historial de migraciones ${remotas.length}/${locales.length} (001–031 sin la 003), sin sondas`);

    // Auth: el reset trunca auth.*; se comprueba y, si quedara algo, se borra
    let u = await listarUsuarios(ctx);
    if (u.length) { aviso(`quedaban ${u.length} usuarios en Auth tras el reset: se borran`); for (const x of u) await ctx.admin.auth.admin.deleteUser(x.id); u = await listarUsuarios(ctx); }
    if (u.length) fallo('No se pudo dejar Auth sin usuarios.');
    ok('Auth sin usuarios');

    await esperarApi(ctx);
    ok('la API (PostgREST) ve el esquema reconstruido');
    await verificarSemilla(ctx);

    // Censo con sonda temporal de solo lectura (migración que aborta con RAISE)
    const num = String(Math.max(...locales.map(Number)) + 1).padStart(3, '0');
    const sonda = join(ctx.wt, `supabase/migrations/${num}_censo_tmp.sql`);
    copyFileSync(join(RAIZ, 'scripts/sql/censo.sql'), sonda);
    let salida = '';
    try { const p = supabase(['db', 'push'], { cwd: ctx.wt, input: 'y\n' }); salida = (p.stdout ?? '') + (p.stderr ?? ''); } finally { rmSync(sonda, { force: true }); }
    const medido = Object.fromEntries([...salida.matchAll(/^([a-z_0-9]+)=(.*?)\s*$/gm)].map((m) => [m[1], m[2]]));
    const difs = Object.entries(CENSO).filter(([k, v]) => medido[k] !== v).map(([k, v]) => `${k}: esperado ${v}, medido ${medido[k] ?? '(sin dato)'}`);
    if (difs.length) fallo('CENSO distinto del esperado de v2.0:\n    ' + difs.join('\n    '));
    ok(`censo v2.0 idéntico (${Object.keys(CENSO).length} cifras: ${CENSO.tablas} tablas · ${CENSO.vistas} vistas · ${CENSO.funciones} funciones · ${CENSO.policies} policies · RLS ${CENSO.rls_activa}/${CENSO.tablas} · pre-request ${CENSO.pre_request} · anon sin nada)`);
    const hist = supabase(['migration', 'list'], { cwd: ctx.wt });
    if (/_censo_tmp/.test(hist.stdout)) fallo('La sonda de censo quedó en el historial.');

    // MODO_EMAIL (variable de Railway, no de la BD)
    if (!args['modo-email-ok']) {
      const r = await preguntar('\n  ¿Confirmas que en Railway (timerx-prod) MODO_EMAIL=log y APP_URL es el dominio de producción? (s/N) ');
      if (!/^s/i.test(r)) fallo('Sin confirmar MODO_EMAIL=log. Se comprueba en Railway y se repite con --modo-email-ok.');
    }
    ok('MODO_EMAIL=log confirmado');
  },

  // ------------------------------------------------------------------------------------------------ d) AUTH
  async auth(ctx) {
    log('\n== CONFIG AUTH ==');
    const s = await (await fetch(`${ctx.url}/auth/v1/settings`, { headers: { apikey: ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } })).json();
    if (s.disable_signup !== true) fallo(`disable_signup = ${s.disable_signup} (debe ser true)`);
    if (s.mailer_autoconfirm !== false) fallo(`mailer_autoconfirm = ${s.mailer_autoconfirm} (debe ser false)`);
    ok('disable_signup: true · mailer_autoconfirm: false');
    const antes = await contarUsuarios(ctx);
    const email = `sonda.${randomBytes(4).toString('hex')}@example.invalid`;
    const r = await fetch(`${ctx.url}/auth/v1/signup`, { method: 'POST', headers: { apikey: ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: randomBytes(12).toString('hex') }) });
    const b = await r.json().catch(() => ({}));
    if (r.status !== 422 || !/signup_disabled/.test(JSON.stringify(b))) fallo(`signUp devolvió ${r.status} ${JSON.stringify(b).slice(0, 120)} (debe ser 422 signup_disabled)`);
    ok('signUp real → 422 signup_disabled');
    const despues = await contarUsuarios(ctx);
    if (despues !== antes) fallo(`El signUp dejó usuarios (${antes} → ${despues})`);
    const esperados = args['usuarios-esperados'] !== undefined ? Number(args['usuarios-esperados']) : (ctx.ref === REF_PROD ? (leerEstado().fases.bootstrap ? 1 : 0) : antes);
    if (despues !== esperados) fallo(`Usuarios en Auth = ${despues}, esperados ${esperados}`);
    ok(`${despues} usuario(s) en Auth tras el intento (esperados ${esperados})`);
  },

  // ------------------------------------------------------------------------------------------------ e) SUPERFICIE
  async superficie(ctx) {
    log('\n== SUPERFICIE ==');
    const { oa, relaciones, rpcs } = await tablasExpuestas(ctx);
    const H = { apikey: ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
    const antes = await contar(ctx, relaciones);
    const malas = [];
    for (const t of relaciones) { const b = await (await fetch(`${ctx.url}/rest/v1/${t}?limit=1`, { headers: H })).json().catch(() => ({})); if (b?.code !== '42501') malas.push(`GET ${t}`); }
    ok(`${relaciones.length - malas.length}/${relaciones.length} tablas y vistas → 42501 con la anon key`);
    const NULO = '00000000-0000-0000-0000-00000000dead';
    // Escrituras inocuas (id inexistente) con la columna REAL de cada tabla: con una columna que no existe PostgREST contesta 400 antes de mirar permisos.
    for (const [t, col] of [['perfil', 'id'], ['imputacion', 'id'], ['periodo', 'id'], ['ticket', 'id'], ['departamento', 'id'], ['empresa_departamento', 'empresa_id'], ['perfil_departamento', 'perfil_id']]) {
      const rs = [await ctx.anon.from(t).update({ [col]: NULO }).eq(col, NULO).select(), await ctx.anon.from(t).insert({ [col]: NULO }).select(), await ctx.anon.from(t).delete().eq(col, NULO).select()];
      if (!rs.every((x) => x.error?.code === '42501')) malas.push(`escritura anon en ${t}`);
    }
    // `cuenta_desactivada_pre_request` es la ÚNICA que anon puede ejecutar (PostgREST la llama antes de cada petición): se excluye, como en el censo.
    const probadas = rpcs.filter((f) => f !== 'cuenta_desactivada_pre_request');
    for (const f of probadas) {
      const r = await fetch(`${ctx.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(cuerpoInocuo(oa, f)) });
      const b = await r.json().catch(() => ({}));
      if (b?.code !== '42501') malas.push(`RPC ${f} (${r.status} ${b?.code ?? ''})`);
    }
    ok(`${probadas.length} RPC → 42501 con los argumentos reales y valores inocuos (norma C)${rpcs.length !== probadas.length ? '; excluida la del pre-request (anon la ejecuta a propósito)' : ''}`);
    if (malas.length) fallo('NO DENEGADO con anon:\n    ' + malas.join('\n    '));
    const despues = await contar(ctx, relaciones);
    if (JSON.stringify(antes) !== JSON.stringify(despues)) fallo('Los conteos cambiaron durante las sondas.');
    ok('conteos idénticos antes/después de las sondas');

    const c = async (ruta, opts = {}) => (await fetch(ctx.app + ruta, { redirect: 'manual', ...opts })).status;
    const chequeos = [['/debug', 404], ['/debug/movil', 404], ['/login', 200], ['/admin', 307]];
    for (const [ruta, esperado] of chequeos) { const s = await c(ruta); if (s !== esperado) fallo(`GET ${ruta} → ${s} (esperado ${esperado})`); }
    const cron = await c('/api/cron/recordatorios', { method: 'POST' });
    if (cron !== 401) fallo(`cron sin secreto → ${cron} (esperado 401)`);
    ok('/debug 404 · /debug/movil 404 · /login 200 · /admin 307 · cron sin secreto 401');
    const html = await (await fetch(ctx.app + '/login')).text();
    const chunks = [...new Set([...html.matchAll(/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))].slice(0, 60);
    const refs = new Set();
    for (const ch of chunks) { const t = await (await fetch(`${ctx.app}/${ch}`)).text(); for (const m of t.matchAll(/([a-z0-9]{20})\.supabase\.co/g)) refs.add(m[1]); }
    if (refs.size !== 1 || !refs.has(ctx.ref)) fallo(`El bundle público apunta a ${[...refs].join(', ') || '(ningún proyecto)'}; debe apuntar solo a ${ctx.ref}`);
    ok('el bundle público solo apunta al Supabase de este entorno');
    const v = await (await fetch(`${ctx.app}/api/version`)).json();
    ok(`/api/version = ${String(v.commit).slice(0, 7)} (${v.rama})`);
  },

  // ------------------------------------------------------------------------------------------------ f) BOOTSTRAP
  async bootstrap(ctx) {
    log('\n== BOOTSTRAP de la cuenta admin_grupo ==');
    const email = args['admin-email'] ?? 'oliver.perez@wowinx.com';
    const nombre = args['admin-nombre'] ?? 'Oliver Perez Parada';
    const empresa = args['admin-empresa'] ?? 'Wowinx SL';
    const a = ['scripts/bootstrap-admin.mjs', '--proyecto', ctx.ref, '--nombre', nombre, '--email', email, '--empresa', empresa];
    if (typeof args['admin-password'] === 'string') a.push('--password', args['admin-password']);
    log('  (la contraseña inicial se muestra UNA vez a continuación; no se guarda en ningún archivo)');
    const r = cmd('node', a, { cwd: RAIZ, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: ctx.url, SUPABASE_SERVICE_ROLE_KEY: ctx.env.SUPABASE_SERVICE_ROLE_KEY } });
    if (r.status !== 0) fallo('bootstrap-admin falló.');
    const { data } = await ctx.admin.from('perfil').select('email, rol, activo').eq('email', email).single();
    if (data?.rol !== 'admin_grupo' || !data.activo) fallo(`La cuenta ${email} no quedó como admin_grupo activo: ${JSON.stringify(data)}`);
    ok(`${email}: admin_grupo activo`);
  },

  // ------------------------------------------------------------------------------------------------ g) VERIFICACIÓN DE ESTRENO (ciclo mínimo con cuenta ad hoc)
  async verificacion(ctx) {
    log('\n== VERIFICACIÓN DE ESTRENO: ciclo mínimo con cuenta ad hoc ==');
    const emailAdmin = args['admin-email'] ?? 'oliver.perez@wowinx.com';
    const emailPrueba = `prueba.estreno.${randomBytes(3).toString('hex')}@wowinx.com`;
    const { relaciones } = await tablasExpuestas(ctx);
    const base = await contar(ctx, relaciones);
    const creado = { userId: null, impId: null };
    const resultados = [];
    const chequeo = (n, v, x = '') => { resultados.push(v); (v ? ok : (m) => console.log('  ✘ ' + m))(n + (x ? ` — ${x}` : '')); if (!v) throw new Fallo(`Falló: ${n}`); };
    const hoyMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
    try {
      // profesional con departamento
      const { data: u, error } = await ctx.admin.auth.admin.createUser({ email: emailPrueba, email_confirm: true, password: randomBytes(12).toString('hex') + 'Aa1', user_metadata: { empresa_id: EMPRESA_WOWINX, nombre: 'Prueba Estreno' } });
      if (error) fallo('No se pudo crear la cuenta de prueba: ' + error.message);
      creado.userId = u.user.id;
      await ctx.admin.from('perfil').update({ departamento_id: DEP_DESARROLLO }).eq('id', creado.userId);
      const { data: perfil } = await ctx.admin.from('perfil').select('rol, departamento_id, empresa_id').eq('id', creado.userId).single();
      chequeo('profesional con departamento (rol empleado, Desarrollo, Wowinx)', perfil.rol === 'empleado' && perfil.departamento_id === DEP_DESARROLLO && perfil.empresa_id === EMPRESA_WOWINX);

      const admin = await sesionDe(ctx, emailAdmin);
      const prof = await sesionDe(ctx, emailPrueba);
      // asignar (con la sesión REAL del admin: pasa por RLS)
      const { error: eAsig } = await admin.cliente.from('empleado_proyecto').insert({ empleado_id: creado.userId, proyecto_id: PROYECTO_XIM, desde: new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10) });
      chequeo('asignar al proyecto XIM (sesión del admin)', !eAsig, eAsig?.message);

      // picker: las especialidades que ve el profesional = las de los departamentos de SU empresa
      const [sub, empDep, fijados] = await Promise.all([
        prof.cliente.from('subcategoria').select('id, nombre, categoria:categoria_id(departamento_id, activa)').eq('activa', true),
        prof.cliente.from('empresa_departamento').select('departamento_id').eq('empresa_id', EMPRESA_WOWINX),
        prof.cliente.from('perfil_departamento').select('departamento_id').eq('perfil_id', creado.userId),
      ]);
      const visibles = new Set((fijados.data ?? []).length ? fijados.data.map((x) => x.departamento_id) : (empDep.data ?? []).map((x) => x.departamento_id));
      const vistas = (sub.data ?? []).filter((s) => s.categoria?.activa && visibles.has(s.categoria.departamento_id));
      const { data: todas } = await ctx.admin.from('subcategoria').select('id, categoria:categoria_id(departamento_id, activa)').eq('activa', true);
      const esperadas = (todas ?? []).filter((s) => s.categoria?.activa && visibles.has(s.categoria.departamento_id)).length;
      chequeo(`picker: ve ${vistas.length} especialidades de ${visibles.size} departamentos de su empresa`, vistas.length === esperadas && vistas.length > 0 && (ctx.ref !== REF_PROD || (vistas.length === SEED.subcategoria && visibles.size === SEED.departamento)));

      // imputar: último día laborable L-V (no festivo)
      const { data: fest } = await ctx.admin.from('festivo').select('fecha');
      const festivos = new Set((fest ?? []).map((f) => f.fecha));
      let fecha = null;
      for (let i = 0; i < 20 && !fecha; i++) { const d = new Date(Date.now() - i * 864e5); const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d); const dow = new Date(iso + 'T12:00:00Z').getUTCDay(); if (iso <= hoyMadrid && dow >= 1 && dow <= 4 && !festivos.has(iso)) fecha = iso; }
      const { data: imp, error: eImp } = await prof.cliente.from('imputacion').insert({ empleado_id: creado.userId, proyecto_id: PROYECTO_XIM, subcategoria_id: SUBCAT_BACKEND, fecha, horas: 2, estado: 'borrador' }).select('id').single();
      chequeo(`imputar 2 h en Backend (${fecha}) como el profesional`, !eImp && imp?.id, eImp?.message);
      creado.impId = imp.id;
      // computar → aprobar
      const { data: n1, error: e1 } = await prof.cliente.rpc('enviar_imputaciones', { p_ids: [creado.impId] });
      chequeo('computar (enviar_imputaciones) → 1 línea', !e1 && n1 === 1, e1?.message ?? `n=${n1}`);
      const { data: n2, error: e2 } = await admin.cliente.rpc('aprobar_imputaciones', { p_ids: [creado.impId] });
      chequeo('aprobar (aprobar_imputaciones, sesión del admin) → 1 línea', !e2 && n2 === 1, e2?.message ?? `n=${n2}`);
      // ficha
      const [anio, mes] = fecha.split('-').map(Number);
      const { data: bal } = await admin.cliente.rpc('balance_mes_empleado', { p_empleado_id: creado.userId, p_anio: anio, p_mes: mes });
      chequeo('ficha: balance del mes del profesional con 2 h imputadas', Number(bal?.[0]?.horas_imputadas) === 2, JSON.stringify(bal?.[0] ?? null));
      // ticket (la primera referencia de un proyecto limpio es T-001)
      const { data: refs } = await ctx.admin.from('ticket').select('ref');
      const mayor = Math.max(0, ...(refs ?? []).map((t) => Number(String(t.ref).replace(/\D/g, '')) || 0));
      const refEsperada = 'T-' + String(mayor + 1).padStart(3, '0');
      const { data: tk, error: eTk } = await prof.cliente.from('ticket').insert({ creado_por: creado.userId, titulo: 'Ticket de verificación de estreno', descripcion: 'Se borra al terminar la verificación.', tipo: 'consulta' }).select('ref').single();
      chequeo(`ticket: referencia ${refEsperada}` + (ctx.ref === REF_PROD ? ' (T-001 en un proyecto limpio)' : ''), !eTk && tk?.ref === refEsperada && (ctx.ref !== REF_PROD || tk.ref === 'T-001'), eTk?.message ?? tk?.ref);
      // pre-request de la 025: cuenta desactivada = sin acceso con el JWT ya emitido
      await ctx.admin.from('perfil').update({ activo: false }).eq('id', creado.userId);
      const bloqueo = await fetch(`${ctx.url}/rest/v1/perfil?select=id&limit=1`, { headers: { apikey: ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${prof.token}` } });
      chequeo('pre-request (025): cuenta desactivada → 403 con el JWT vigente', bloqueo.status === 403, `HTTP ${bloqueo.status}`);
    } finally {
      // REVERSIÓN (siempre): se borra todo lo creado y se resincroniza la referencia de tickets
      if (creado.userId) {
        await ctx.admin.from('ticket_comentario').delete().in('ticket_id', ((await ctx.admin.from('ticket').select('id').eq('creado_por', creado.userId)).data ?? []).map((t) => t.id));
        await ctx.admin.from('ticket_lectura').delete().eq('perfil_id', creado.userId);
        await ctx.admin.from('ticket').delete().eq('creado_por', creado.userId);
        await ctx.admin.from('imputacion').delete().eq('empleado_id', creado.userId);
        await ctx.admin.from('empleado_proyecto').delete().eq('empleado_id', creado.userId);
        await ctx.admin.from('perfil').delete().eq('id', creado.userId);
        await ctx.admin.auth.admin.deleteUser(creado.userId);
      }
      const { error: eRef } = await ctx.admin.rpc('ticket_ref_resincronizar');
      if (eRef) aviso('ticket_ref_resincronizar: ' + eRef.message);
    }
    const fin = await contar(ctx, relaciones);
    const distintos = Object.keys(base).filter((k) => base[k] !== fin[k]).map((k) => `${k}: ${base[k]} → ${fin[k]}`);
    if (distintos.length) fallo('Los conteos NO volvieron a la base: ' + distintos.join(' · '));
    ok('reversión: conteos idénticos a los de antes del ciclo');
    if (ctx.ref === REF_PROD) {
      const resto = Object.entries(fin).filter(([k, v]) => v && !(k in SEED) && !['perfil', 'auth.users'].includes(k));
      if (fin.perfil !== 1 || fin['auth.users'] !== 1 || resto.length) fallo(`Producción debería quedar con SEED + 1 cuenta; sobran: perfil=${fin.perfil}, auth=${fin['auth.users']}, otros=${JSON.stringify(resto)}`);
      ok('producción queda con SEED + mi cuenta (perfil 1, auth 1, resto de tablas vacías)');
    }
    if (ctx.ref === REF_PROD) {
      const { data } = await ctx.admin.from('ticket').select('ref').limit(1);
      if ((data ?? []).length) fallo('Quedó algún ticket.');
    }
  },

  // ------------------------------------------------------------------------------------------------ h) CIERRE
  async cierre(ctx) {
    log('\n== CIERRE ==');
    const par = cmd('node', [join(RAIZ, 'scripts/comprobar-paridad.mjs')], { cwd: RAIZ });
    log(par.stdout.split('\n').map((l) => '    ' + l).join('\n'));
    if (ctx.ref === REF_PROD && !/EN PARIDAD/.test(par.stdout)) fallo('Tras el reset se exige EN PARIDAD (producción == main y 30/30 migraciones).');
    if (par.status !== 0) fallo('comprobar-paridad: DIVERGENCIA.');
    ok(ctx.ref === REF_PROD ? 'EN PARIDAD' : 'paridad sin divergencia (ensayo)');
    const v = await (await fetch(`${ctx.app}/api/version`)).json();
    ok(`/api/version = ${String(v.commit).slice(0, 7)} (${v.rama})`);
    log('\n  Comprobar a mano (Railway MCP / panel): timerx-prod y timerx-prod-cron-recordatorios en SUCCESS, MODO_EMAIL=log.');
    log('  Entrega: docs/dia-1.md (cambiar tu contraseña, rotar la de BD, CIF, festivos, profesionales reales, tarifas).');
  },
};

// ---------------------------------------------------------------------------------------------------------------- semilla (contenido declarado)
async function verificarSemilla(ctx) {
  const { relaciones } = await tablasExpuestas(ctx);
  const c = await contar(ctx, relaciones);
  const malos = relaciones.filter((t) => c[t] !== (SEED[t] ?? 0)).map((t) => `${t}: ${c[t]} (esperado ${SEED[t] ?? 0})`);
  if (c['auth.users'] !== 0) malos.push(`auth.users: ${c['auth.users']} (esperado 0)`);
  if (malos.length) fallo('El contenido tras la semilla no es el declarado:\n    ' + malos.join('\n    '));
  ok('conteos = seed-produccion.sql (' + Object.entries(SEED).map(([k, v]) => `${k} ${v}`).join(' · ') + '); el resto, vacío');
  const g = async (t, s) => (await ctx.admin.from(t).select(s)).data ?? [];
  const empresas = await g('empresa', 'id, nombre, cif');
  if (empresas.length !== 3 || empresas.some((e) => e.cif !== null)) fallo('Las 3 empresas deben nacer SIN CIF.');
  const jornada = await g('empresa_jornada', 'empresa_id, dia_semana, horas');
  for (const e of empresas) {
    const h = [1, 2, 3, 4, 5, 6, 7].map((d) => Number(jornada.find((j) => j.empresa_id === e.id && j.dia_semana === d)?.horas));
    if (JSON.stringify(h) !== JSON.stringify([8, 8, 8, 8, 5.5, 0, 0])) fallo(`Jornada de ${e.nombre} = ${h.join('/')} (debe ser 8/8/8/8/5,5/0/0).`);
  }
  ok('3 empresas sin CIF, con jornada 8/8/8/8/5,5/0/0');
  const deps = await g('departamento', 'id, nombre, activo, color');
  const cats = await g('categoria', 'id, nombre, activa, departamento_id');
  const espejoOk = deps.every((d) => d.color && d.activo && cats.some((x) => x.departamento_id === d.id && x.nombre === d.nombre && x.activa));
  if (!espejoOk || deps.map((d) => d.nombre).sort().join('|') !== ['Administración y Finanzas', 'Desarrollo', 'Diseño', 'Legal'].join('|')) fallo('Departamentos/espejos/colores no son los declarados (Administración y Finanzas, Desarrollo, Diseño, Legal).');
  ok('4 departamentos con color y categoría espejo 1:1 (mismo nombre, activos)');
  const subs = await g('subcategoria', 'nombre, categoria:categoria_id(nombre)');
  const porDep = subs.reduce((a, s) => ({ ...a, [s.categoria.nombre]: (a[s.categoria.nombre] ?? 0) + 1 }), {});
  if (JSON.stringify(porDep) !== JSON.stringify({ Desarrollo: 4, Diseño: 3, Legal: 4, 'Administración y Finanzas': 3 }) && JSON.stringify(Object.entries(porDep).sort()) !== JSON.stringify(Object.entries({ Desarrollo: 4, Diseño: 3, Legal: 4, 'Administración y Finanzas': 3 }).sort())) fallo(`Especialidades por departamento: ${JSON.stringify(porDep)}`);
  ok('14 especialidades (Desarrollo 4 · Diseño 3 · Legal 4 · Administración y Finanzas 3)');
  const ed = await g('empresa_departamento', 'empresa_id, departamento_id');
  if (ed.length !== 12) fallo(`empresa_departamento = ${ed.length} (12 = 3 empresas × 4)`);
  const ajustes = Object.fromEntries((await g('ajuste', 'clave, valor')).map((a) => [a.clave, a.valor]));
  const esperadoAj = { jornada_horas: 8, tope_horas_dia: 12, descripcion_obligatoria: false, bloquear_meses_cerrados: true, recordatorio_email: false };
  for (const [k, v] of Object.entries(esperadoAj)) if (JSON.stringify(ajustes[k]) !== JSON.stringify(v)) fallo(`ajuste ${k} = ${JSON.stringify(ajustes[k])} (esperado ${JSON.stringify(v)})`);
  if (JSON.stringify(ajustes.jornada_semanal_defecto) !== JSON.stringify([8, 8, 8, 8, 5.5, 0, 0])) fallo('ajuste jornada_semanal_defecto no es 8/8/8/8/5,5/0/0');
  ok('ajustes de producción (jornada 8, tope 12, descripción no obligatoria, bloqueo de meses cerrados, recordatorio off, jornada por defecto 8/8/8/8/5,5/0/0)');
  const proyectos = (await g('proyecto', 'codigo')).map((p) => p.codigo).sort().join(',');
  if (proyectos !== 'ASESINT,INTERNO,LAUNCHER,MCHEF,TRX,WEBCORP,XIM') fallo('Proyectos distintos de los declarados: ' + proyectos);
  ok('7 proyectos (ASESINT, INTERNO, LAUNCHER, MCHEF, TRX, WEBCORP, XIM) · mapa 6 áreas / 22 elementos · 8 festivos');
}

// ---------------------------------------------------------------------------------------------------------------- main
try {
  const ctx = await contexto();
  log(`Reset de estreno · proyecto ${ctx.ref}${ctx.ensayo ? ' (ENSAYO sobre la demo; fases destructivas desactivadas)' : ' (PRODUCCIÓN)'} · fases: ${ctx.lista.join(' → ')}`);
  await puertaProduccion(ctx);
  // Orden de las fases que escriben: cada una exige las anteriores en el archivo de estado (las de solo lectura —auth, superficie, cierre— no exigen nada).
  const REQUIERE = { promocion: ['pre'], bd: ['pre', 'promocion'], bootstrap: ['bd'], verificacion: ['bootstrap'] };
  for (const f of ctx.lista) {
    const faltan = ctx.ensayo ? [] : (REQUIERE[f] ?? []).filter((x) => !leerEstado().fases[x]?.ok);
    if (faltan.length) fallo(`La fase «${f}» exige haber completado antes: ${faltan.join(', ')} (reset-estreno.estado.json).`);
    await fases[f](ctx);
    marcar(f);
    if (ctx.lista.length > 1 && f !== ctx.lista.at(-1)) await pausa(`Fase «${f}» completa`);
  }
  log('\n✅ ' + (ctx.lista.length > 1 ? 'Todas las fases completas.' : `Fase «${fase}» completa.`));
} catch (e) {
  if (e instanceof Fallo) { console.error('\n✘ ' + e.message); process.exit(1); }
  console.error(e); process.exit(2);
}
