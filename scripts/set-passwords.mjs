// Fija una contraseña compartida para los 11 usuarios de demo (Admin API).
// La contraseña NUNCA se hardcodea aquí: se pasa como argumento en la propia
// llamada, para no dejarla en el historial de git (el repo es público).
//
// Uso: node scripts/set-passwords.mjs "<contraseña>"

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
  } catch {}
}
cargarEnvLocal();

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Uso: node scripts/set-passwords.mjs "<contraseña de al menos 8 caracteres>"');
  process.exit(1);
}

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const IDS = [
  '10000000-0000-0000-0000-000000000001', // Cristian Haro
  '10000000-0000-0000-0000-000000000002', // Verónica Salguero
  '10000000-0000-0000-0000-000000000003', // Andrés Fuentes
  '10000000-0000-0000-0000-000000000004', // Leo Silva
  '10000000-0000-0000-0000-000000000005', // Sara Martín
  '10000000-0000-0000-0000-000000000006', // Ana Ruiz
  '10000000-0000-0000-0000-000000000007', // Cosme Hernandez
  '10000000-0000-0000-0000-000000000008', // Daniel Ramírez
  '10000000-0000-0000-0000-000000000009', // Marta Gil
  '10000000-0000-0000-0000-000000000010', // Enrique Robles
  '10000000-0000-0000-0000-000000000011', // Marina Ortega
];

for (const id of IDS) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
  if (error) console.error(`✗ ${id}: ${error.message}`);
  else console.log(`✓ ${data.user.email}`);
}
