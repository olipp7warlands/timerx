// Cambia el dominio de las 11 cuentas de demo de @sirtana.net a @wowinx.com
// (Admin API + perfil.email, sin trigger que sincronice UPDATE de auth.users).
//
// Uso: node scripts/cambiar-emails.mjs
//
// Preflight: valida que el nombre real en BD de cada id corresponde al
// local-part del email nuevo (nombre.apellido) ANTES de mutar nada -- un id
// traspuesto en CAMBIOS pasaría un conteo de éxitos sin ningún error y
// dejaría a alguien con el email de otra persona.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function cargarEnvLocal() {
  try {
    const contenido = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
    for (const linea of contenido.split('\n')) {
      const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // .env.local no existe: se asume que las vars ya están en el entorno.
  }
}

cargarEnvLocal();

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// NO incluye olcasan08@gmail.com (acceso real del usuario) -- son las 11 cuentas
// de demo de scripts/seed-usuarios.mjs, ninguna otra.
const CAMBIOS = [
  { id: '10000000-0000-0000-0000-000000000001', email: 'cristian.haro@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000002', email: 'veronica.salguero@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000003', email: 'andres.fuentes@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000004', email: 'leo.silva@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000005', email: 'sara.martin@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000006', email: 'ana.ruiz@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000007', email: 'cosme.hernandez@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000008', email: 'daniel.ramirez@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000009', email: 'marta.gil@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000010', email: 'enrique.robles@wowinx.com' },
  { id: '10000000-0000-0000-0000-000000000011', email: 'marina.ortega@wowinx.com' },
];

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nombreEsperado = (nombre) => normalizar(nombre).trim().replace(/\s+/g, '.');
const localPart = (email) => email.split('@')[0];

// 1. Preflight: nombre real en BD vs local-part del email nuevo, para los 11 ids.
const { data: perfiles, error: errLectura } = await supabaseAdmin
  .from('perfil')
  .select('id, nombre')
  .in('id', CAMBIOS.map((c) => c.id));

if (errLectura) {
  console.error('No se pudo leer perfil:', errLectura.message);
  process.exit(1);
}

const porId = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]));
const mismatches = CAMBIOS.filter((c) => nombreEsperado(porId[c.id] ?? '') !== localPart(c.email));

if (mismatches.length > 0) {
  console.error('Abortado -- no coincide nombre (BD) con local-part del email nuevo para:');
  for (const m of mismatches) {
    console.error(`  ${m.id}: BD="${porId[m.id] ?? '(no encontrado)'}" vs email="${m.email}"`);
  }
  process.exit(1);
}

console.log('Preflight OK: los 11 nombres corresponden a sus emails nuevos. Aplicando cambios...\n');

// 2. Solo si TODO validó, se muta: auth.users + perfil.email.
for (const { id, email } of CAMBIOS) {
  const { error: errAuth } = await supabaseAdmin.auth.admin.updateUserById(id, { email, email_confirm: true });
  if (errAuth) {
    console.error(`✗ auth ${id}: ${errAuth.message}`);
    continue;
  }
  const { error: errPerfil } = await supabaseAdmin.from('perfil').update({ email }).eq('id', id);
  if (errPerfil) console.error(`✗ perfil ${id}: ${errPerfil.message}`);
}

// 3. Verificación final: releer nombre+email juntos (correspondencia, no conteo de éxitos).
const { data: tras } = await supabaseAdmin.from('perfil').select('id, nombre, email').in('id', CAMBIOS.map((c) => c.id));

console.log('\nEstado final (nombre -> email):');
for (const p of tras ?? []) {
  console.log(`  ${p.nombre.padEnd(20)} -> ${p.email}`);
}
