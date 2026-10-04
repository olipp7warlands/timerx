// Paridad demo ↔ producción. Solo lectura. Uso: node scripts/comprobar-paridad.mjs   (desde cualquier worktree del repo)
//
// Regla: producción NUNCA va por delante ni divergida; la demo (pre) puede ir por delante de producción (es el flujo natural).
//  1. Producción se mide por su BASE en main: merge-base(SHA de prod, origin/main). La rama `produccion` lleva commits propios
//     (merges de promoción, config.toml de Auth, seed): su SHA no es ancestro literal de main y no tiene por qué serlo. Lo que no
//     puede haber es CONTENIDO propio fuera de ARCHIVOS_PROPIOS_PROD -> divergencia.
//  2. La demo debe desplegar exactamente HEAD de origin/main.
//  3. Migraciones aplicadas en cada BD == carpeta supabase/migrations del repo EN SU SHA (`supabase migration list`, worktree enlazado).
// Salida: EN PARIDAD (exit 0) / PRE POR DELANTE (exit 0, esperable) / DIVERGENCIA (exit 1).
import { execFileSync } from 'node:child_process';

const URLS = {
  demo: process.env.URL_DEMO ?? 'https://timerx-production.up.railway.app',
  prod: process.env.URL_PROD ?? 'https://timerx-prod-production.up.railway.app',
};
const ARCHIVOS_PROPIOS_PROD = ['supabase/config.toml', 'supabase/seed-produccion.sql'];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gitOk = (...args) => {
  try {
    execFileSync('git', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const corto = (sha) => (sha ? sha.slice(0, 7) : '—');

const errores = [];
const avisos = [];
const lineas = [];
let preDelante = 0;

async function version(nombre) {
  try {
    const r = await fetch(`${URLS[nombre]}/api/version`, { headers: { accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error(`HTTP ${r.status}, no es JSON (¿esa app aún no tiene /api/version desplegado?)`);
    return await r.json();
  } catch (e) {
    errores.push(`${nombre}: no se pudo leer /api/version → ${e.message}`);
    return null;
  }
}

/** Versiones de migración de la carpeta del repo EN un commit. */
function migracionesEn(sha) {
  const out = git('ls-tree', '--name-only', sha, 'supabase/migrations/');
  return out
    .split('\n')
    .map((f) => f.match(/migrations\/(\d+)_[^/]*\.sql$/)?.[1])
    .filter(Boolean);
}

/** Versiones aplicadas en la BD enlazada al worktree `dir` (`supabase migration list`). */
function migracionesRemotas(dir) {
  const salida = execFileSync('supabase', ['migration', 'list'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const remotas = [];
  for (const linea of salida.split('\n')) {
    const m = linea.match(/^\s*(\d+)?\s*\|\s*(\d+)?\s*\|/);
    if (m?.[2]) remotas.push(m[2]);
  }
  return remotas;
}

function comprobarMigraciones(nombre, dir, sha) {
  if (!dir || !sha) return;
  let remotas;
  try {
    remotas = migracionesRemotas(dir);
  } catch (e) {
    errores.push(`${nombre}: no se pudo listar las migraciones de la BD (${(e.stderr || e.message).toString().split('\n')[0]})`);
    return;
  }
  const repo = migracionesEn(sha);
  const faltan = repo.filter((v) => !remotas.includes(v));
  const sobran = remotas.filter((v) => !repo.includes(v));
  if (!faltan.length && !sobran.length) lineas.push(`  migraciones ${nombre}: ${remotas.length} en BD == ${repo.length} en el repo @${corto(sha)}`);
  else {
    if (faltan.length) errores.push(`${nombre}: migraciones del repo @${corto(sha)} NO aplicadas en su BD: ${faltan.join(', ')}`);
    if (sobran.length) errores.push(`${nombre}: la BD tiene migraciones que el repo @${corto(sha)} no tiene: ${sobran.join(', ')}`);
  }
}

function rutaWorktree(rama) {
  const bloques = git('worktree', 'list', '--porcelain').split('\n\n');
  for (const b of bloques) {
    if (b.includes(`branch refs/heads/${rama}`)) return b.match(/^worktree (.+)$/m)?.[1] ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
try {
  git('fetch', 'origin', '--quiet');
} catch {
  avisos.push('git fetch falló: se compara con lo último que se conoce de origin');
}
const main = git('rev-parse', 'origin/main');
if (git('rev-parse', 'main') !== main) avisos.push(`main local (${corto(git('rev-parse', 'main'))}) ≠ origin/main (${corto(main)}): se usa origin/main`);

const [demo, prod] = await Promise.all([version('demo'), version('prod')]);

// 2. demo == HEAD de main
if (demo?.commit) {
  if (demo.commit === main) lineas.push(`  demo: ${corto(demo.commit)} == origin/main`);
  else if (!gitOk('cat-file', '-e', `${demo.commit}^{commit}`)) errores.push(`demo despliega ${corto(demo.commit)}, commit desconocido para este repo`);
  else if (gitOk('merge-base', '--is-ancestor', demo.commit, main)) {
    errores.push(`demo ATRASADA: despliega ${corto(demo.commit)}, origin/main es ${corto(main)} (${git('rev-list', '--count', `${demo.commit}..${main}`)} commits sin desplegar; ¿build en curso?)`);
  } else errores.push(`demo DIVERGIDA: ${corto(demo.commit)} no es ancestro de origin/main`);
} else if (demo) errores.push('demo: /api/version no informa del commit (variable RAILWAY_GIT_COMMIT_SHA ausente)');

// 1. prod: base en main + contenido propio permitido
let baseProd = null;
if (prod?.commit) {
  if (!gitOk('cat-file', '-e', `${prod.commit}^{commit}`)) errores.push(`prod despliega ${corto(prod.commit)}, commit desconocido para este repo (¿git fetch? ¿commit solo en producción?)`);
  else {
    baseProd = git('merge-base', prod.commit, main);
    const propios = git('diff', '--name-only', baseProd, prod.commit).split('\n').filter(Boolean);
    const ajenos = propios.filter((f) => !ARCHIVOS_PROPIOS_PROD.includes(f));
    if (ajenos.length) errores.push(`prod DIVERGIDA: contiene cambios que main no tiene fuera de los archivos propios de producción: ${ajenos.join(', ')}`);
    else lineas.push(`  prod: ${corto(prod.commit)} (rama ${prod.rama ?? '?'}) · base en main ${corto(baseProd)} · propios permitidos: ${propios.join(', ') || 'ninguno'}`);
    preDelante = Number(git('rev-list', '--count', `${baseProd}..${main}`));
  }
} else if (prod) errores.push('prod: /api/version no informa del commit (variable RAILWAY_GIT_COMMIT_SHA ausente)');

// 3. migraciones
const wtDemo = rutaWorktree('main');
const wtProd = rutaWorktree('produccion');
if (!wtProd) avisos.push('no hay worktree de la rama produccion: no se comprueban las migraciones de producción');
if (demo?.commit && gitOk('cat-file', '-e', `${demo.commit}^{commit}`)) comprobarMigraciones('demo', wtDemo, demo.commit);
if (prod?.commit && gitOk('cat-file', '-e', `${prod.commit}^{commit}`)) comprobarMigraciones('prod', wtProd, prod.commit);

// ---------------------------------------------------------------------------------------------------------------------------------
console.log(`Paridad demo ↔ producción · origin/main ${corto(main)}`);
if (demo) console.log(`  /api/version demo: ${corto(demo.commit)} · ${demo.rama ?? '?'} · build ${demo.build ?? '?'}`);
if (prod) console.log(`  /api/version prod: ${corto(prod.commit)} · ${prod.rama ?? '?'} · build ${prod.build ?? '?'}`);
for (const l of lineas) console.log(l);
for (const a of avisos) console.log(`  aviso: ${a}`);
for (const e of errores) console.log(`  ERROR: ${e}`);

if (errores.length) {
  console.log('\nDIVERGENCIA (error): no promocionar ni dar nada por bueno hasta resolverlo.');
  process.exit(1);
}
if (preDelante > 0) console.log(`\nPRE POR DELANTE (${preDelante} commit${preDelante === 1 ? '' : 's'} de main sin promocionar; esperable).`);
else console.log('\nEN PARIDAD.');
