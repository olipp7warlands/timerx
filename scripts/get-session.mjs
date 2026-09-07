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

const email = process.argv[2];
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (linkError) { console.error(linkError.message); process.exit(1); }

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: sessionData, error: verifyError } = await anon.auth.verifyOtp({
  type: 'magiclink',
  token_hash: linkData.properties.hashed_token,
});
if (verifyError) { console.error(verifyError.message); process.exit(1); }
console.log(JSON.stringify({ access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token }));
