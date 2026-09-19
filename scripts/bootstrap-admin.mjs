// Bootstrap de PRODUCCION: crea LA PRIMERA cuenta admin_grupo de un proyecto Supabase nuevo (service_role). Una sola vez.
//
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clave> \
//     node scripts/bootstrap-admin.mjs --proyecto <ref> --nombre "Nombre Apellido" --email persona@empresa.com --empresa "Wowinx SL" [--password <inicial>]
//
// - NO lee .env.local a proposito: las claves de produccion viajan solo por variables de entorno del operador (nunca en el repo ni en la demo).
// - `--proyecto <ref>` debe coincidir con el ref de la URL: impide ejecutarlo contra el proyecto equivocado (p. ej. la demo).
// - Solo funciona con la base VACIA de cuentas (0 perfiles) y con el seed estructural aplicado (la empresa existe). `--permitir-no-vacio` existe
//   unicamente para PROBAR el script contra la demo con una cuenta de prueba que se borra despues.
// - Sin `--password`, genera una contrasena inicial aleatoria y la imprime UNA vez (la persona la cambia al entrar: menu del avatar).
//   El resto de cuentas las crea el admin desde el panel (Usuarios) o el importador; este script no sirve para eso.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);
const fallo = (m) => { console.error('✗ ' + m); process.exit(1); };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) fallo('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno (este script no lee .env.local).');
const ref = new URL(url).hostname.split('.')[0];
if (args.proyecto !== ref) fallo(`--proyecto debe ser el ref del proyecto destino (${ref}); recibido: ${args.proyecto ?? '(nada)'}. Comprueba que es el proyecto correcto.`);
for (const k of ['nombre', 'email', 'empresa']) if (typeof args[k] !== 'string' || !args[k].trim()) fallo(`Falta --${k}`);
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email)) fallo('El email no tiene formato valido');

const admin = createClient(url, clave, { auth: { autoRefreshToken: false, persistSession: false } });

const { count: perfiles, error: e0 } = await admin.from('perfil').select('*', { count: 'exact', head: true });
if (e0) fallo('No se pudo leer perfil (¿migraciones aplicadas?): ' + e0.message);
if (perfiles !== 0 && !args['permitir-no-vacio']) fallo(`La base ya tiene ${perfiles} perfiles: el bootstrap solo es para un proyecto sin cuentas.`);

const { data: empresas, error: e1 } = await admin.from('empresa').select('id, nombre').eq('nombre', args.empresa);
if (e1 || empresas?.length !== 1) fallo(`No existe exactamente una empresa llamada «${args.empresa}» (¿seed estructural aplicado?).`);

const generada = typeof args.password !== 'string';
const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const password = generada ? Array.from(randomBytes(16), (b) => alfabeto[b % alfabeto.length]).join('') : args.password;
if (password.length < 8) fallo('La contrasena inicial debe tener al menos 8 caracteres.');

// handle_new_user() (023) crea el perfil SIEMPRE como 'empleado': el rol de admin se asigna despues, aqui, con service_role.
const { data: creada, error: e2 } = await admin.auth.admin.createUser({
  email: args.email,
  password,
  email_confirm: true,
  user_metadata: { empresa_id: empresas[0].id, nombre: args.nombre },
});
if (e2 || !creada?.user) fallo('No se pudo crear la cuenta: ' + (e2?.message ?? 'sin usuario'));
const id = creada.user.id;

const { data: filas, error: e3 } = await admin.from('perfil').update({ rol: 'admin_grupo' }).eq('id', id).select('id, rol, empresa_id, activo');
if (e3 || filas?.length !== 1) {
  await admin.auth.admin.deleteUser(id);
  fallo('La cuenta se creo pero no se pudo asignar el rol (revertida, cuenta borrada): ' + (e3?.message ?? 'perfil no encontrado'));
}

console.log(`✓ Proyecto ${ref}: creada la cuenta admin_grupo`);
console.log(`  nombre : ${args.nombre}`);
console.log(`  email  : ${args.email}`);
console.log(`  empresa: ${args.empresa}`);
console.log(`  rol    : ${filas[0].rol} (activo=${filas[0].activo})`);
console.log(`  id     : ${id}`);
if (generada) {
  console.log('');
  console.log(`  CONTRASENA INICIAL (se muestra una sola vez; cambiarla al entrar): ${password}`);
}
