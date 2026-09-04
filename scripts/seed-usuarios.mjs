// Crea los usuarios de auth.users del seed de desarrollo vía Admin API.
// El trigger on_auth_user_created (handle_new_user) crea automáticamente la fila
// en `perfil` leyendo empresa_id/nombre/rol de user_metadata.
//
// Requiere en el entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Uso: node scripts/seed-usuarios.mjs
//
// Los UUIDs son fijos (no gen_random_uuid()) para poder referenciarlos desde
// supabase/seed_datos.sql. Los IDs de empresa deben coincidir con los insertados
// en supabase/seed.sql.

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno o .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// UUIDs fijos de empresa (deben coincidir con supabase/seed.sql).
const EMPRESA = {
  wowinx: '00000000-0000-0000-0000-000000000001',
  malaga_cf: '00000000-0000-0000-0000-000000000002',
  legal_norte: '00000000-0000-0000-0000-000000000003',
};

// UUIDs fijos de perfil, referenciados luego por supabase/seed_datos.sql.
const USUARIOS = [
  { id: '10000000-0000-0000-0000-000000000001', email: 'oliver.perez+cristian@sirtana.net', nombre: 'Cristian Haro', rol: 'admin_grupo', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000002', email: 'oliver.perez+veronica@sirtana.net', nombre: 'Verónica Salguero', rol: 'empleado', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000003', email: 'oliver.perez+andres@sirtana.net', nombre: 'Andrés Fuentes', rol: 'empleado', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000004', email: 'oliver.perez+leo@sirtana.net', nombre: 'Leo Silva', rol: 'empleado', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000005', email: 'oliver.perez+sara@sirtana.net', nombre: 'Sara Martín', rol: 'empleado', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000006', email: 'oliver.perez+anaruiz@sirtana.net', nombre: 'Ana Ruiz', rol: 'empleado', empresa_id: EMPRESA.legal_norte },
  // Cosme y Daniel: el mock los muestra con email @wowinx.com y departamento 3B3
  // (PLAN.md sección 6 los agrupaba junto a "Jurídico", pero el mock manda como fuente de UI).
  { id: '10000000-0000-0000-0000-000000000007', email: 'oliver.perez+cosme@sirtana.net', nombre: 'Cosme Hernandez', rol: 'empleado', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000008', email: 'oliver.perez+daniel@sirtana.net', nombre: 'Daniel Ramírez', rol: 'empleado', empresa_id: EMPRESA.wowinx },
  { id: '10000000-0000-0000-0000-000000000009', email: 'oliver.perez+marta@sirtana.net', nombre: 'Marta Gil', rol: 'empleado', empresa_id: EMPRESA.legal_norte },
  { id: '10000000-0000-0000-0000-000000000010', email: 'oliver.perez+enrique@sirtana.net', nombre: 'Enrique Robles', rol: 'admin_empresa', empresa_id: EMPRESA.malaga_cf },
];

for (const u of USUARIOS) {
  const { error } = await supabaseAdmin.auth.admin.createUser({
    id: u.id,
    email: u.email,
    email_confirm: true,
    user_metadata: { empresa_id: u.empresa_id, nombre: u.nombre, rol: u.rol },
  });

  if (error) {
    console.error(`✗ ${u.email}: ${error.message}`);
  } else {
    console.log(`✓ ${u.nombre} <${u.email}> (${u.rol})`);
  }
}
