// Pack de revision de PRODUCCION (reversible): instala datos de prueba INEQUIVOCOS (cuentas "Prueba ...",
// prueba.*@wowinx.com) para que el admin real revise la app con datos realistas antes de meter al equipo. Su
// inverso los quita por completo. Mismas convenciones que scripts/bootstrap-admin.mjs: claves solo por entorno del
// operador (nunca .env.local), guarda --proyecto <ref> igual al de la URL, contrasena generada y mostrada UNA vez.
//
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/pack-revision.mjs instalar --proyecto <ref>
//     node scripts/pack-revision.mjs desinstalar --proyecto <ref>
//     node scripts/pack-revision.mjs desinstalar --proyecto <ref> --por-patron --si   (respaldo, ver abajo)
//
// - Via preferente de desinstalar: lee scripts/.pack-revision-estado.json (en .gitignore -- recibo local del propio
//   operador, no un artefacto de repo), escrito por "instalar" con los IDs exactos creados.
// - Respaldo "--por-patron": si el archivo de estado se perdio (un clon nuevo, una limpieza accidental), deriva los
//   objetivos EN VIVO por el patron de email (prueba.%@wowinx.com) y todo lo que cuelga de esos IDs. Imprime la
//   lista completa y exige --si explicito antes de borrar nada -- nunca borra por sorpresa.
// - El pack se parece al uso real donde sale barato: las ausencias se crean con sesion real de la propia cuenta de
//   prueba (magic link -> verifyOtp, nunca contrasenas tecleadas), llamando de verdad a solicitar_ausencia /
//   aprobar_ausencia -- no un INSERT/UPDATE directo saltandose el RPC.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(3).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);
const accion = process.argv[2];
const fallo = (m) => {
  console.error('✗ ' + m);
  process.exit(1);
};
if (!['instalar', 'desinstalar'].includes(accion)) fallo('Uso: node scripts/pack-revision.mjs instalar|desinstalar --proyecto <ref> [--por-patron --si]');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !claveServicio) fallo('Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en el entorno (este script no lee .env.local).');
const ref = new URL(url).hostname.split('.')[0];
if (args.proyecto !== ref) fallo(`--proyecto debe ser el ref del proyecto destino (${ref}); recibido: ${args.proyecto ?? '(nada)'}. Comprueba que es el proyecto correcto.`);

const admin = createClient(url, claveServicio, { auth: { autoRefreshToken: false, persistSession: false } });
const ESTADO_PATH = join(dirname(fileURLToPath(import.meta.url)), '.pack-revision-estado.json');
const PATRON_EMAIL = 'prueba.%@wowinx.com';

/** Sesion REAL de una cuenta de prueba (magic link -> verifyOtp), sujeta a RLS -- nunca se teclea una contrasena. */
async function comoUsuario(email) {
  const { data: l, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (e1) throw e1;
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: l.properties.hashed_token });
  if (error) throw error;
  return createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
}

const EMPLEADOS = [
  { nombre: 'Prueba Marina López', email: 'prueba.marina@wowinx.com', empresa: 'Wowinx SL', proyecto: 'XIM', subcategoria: 'Backend' },
  { nombre: 'Prueba Diego Cano', email: 'prueba.diego@wowinx.com', empresa: 'Wowinx SL', proyecto: 'TRX', subcategoria: 'Backend' },
  { nombre: 'Prueba Carla Ibáñez', email: 'prueba.carla@wowinx.com', empresa: 'Málaga CF SAD', proyecto: 'WEBCORP', subcategoria: 'Frontend' },
  { nombre: 'Prueba Rubén Soto', email: 'prueba.ruben@wowinx.com', empresa: 'Legal Norte SL', proyecto: 'ASESINT', subcategoria: 'Contratos' },
  { nombre: 'Prueba Noa Vidal', email: 'prueba.noa@wowinx.com', empresa: 'Wowinx SL', proyecto: 'XIM', subcategoria: 'QA' },
];

async function instalar() {
  if (existsSync(ESTADO_PATH)) fallo(`Ya hay un pack instalado (${ESTADO_PATH} existe). Desinstálalo primero.`);
  const { count, error: eCount } = await admin.from('perfil').select('*', { count: 'exact', head: true }).like('email', PATRON_EMAIL);
  if (eCount) fallo('No se pudo comprobar cuentas de prueba previas: ' + eCount.message);
  if (count > 0) fallo(`Ya hay ${count} cuentas ${PATRON_EMAIL} sin archivo de estado -- usa "desinstalar --por-patron" antes de instalar de nuevo.`);

  const { data: empresas, error: eEmp } = await admin.from('empresa').select('id, nombre');
  if (eEmp) fallo('No se pudieron leer empresas: ' + eEmp.message);
  const { data: proyectos, error: ePro } = await admin.from('proyecto').select('id, codigo');
  if (ePro) fallo('No se pudieron leer proyectos: ' + ePro.message);
  const { data: subcats, error: eSub } = await admin.from('subcategoria').select('id, nombre');
  if (eSub) fallo('No se pudieron leer subcategorías: ' + eSub.message);
  const idEmpresa = (n) => empresas.find((e) => e.nombre === n)?.id ?? fallo(`No existe la empresa "${n}"`);
  const idProyecto = (c) => proyectos.find((p) => p.codigo === c)?.id ?? fallo(`No existe el proyecto "${c}"`);
  const idSubcat = (n) => subcats.find((s) => s.nombre === n)?.id ?? fallo(`No existe la subcategoría "${n}"`);

  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const password = Array.from(randomBytes(16), (b) => alfabeto[b % alfabeto.length]).join('');

  console.log('=== Instalando pack de revisión ===');
  const creados = [];
  for (const e of EMPLEADOS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: e.email,
      password,
      email_confirm: true,
      user_metadata: { empresa_id: idEmpresa(e.empresa), nombre: e.nombre },
    });
    if (error || !data.user) fallo(`No se pudo crear ${e.email}: ` + (error?.message ?? 'sin usuario'));
    creados.push({ ...e, id: data.user.id });
    console.log(`✓ cuenta   ${e.email} (${e.empresa} · ${e.proyecto})`);
  }

  for (const e of creados) {
    const { error } = await admin.from('empleado_proyecto').upsert(
      { empleado_id: e.id, proyecto_id: idProyecto(e.proyecto), desde: '2026-09-01', hasta: null },
      { onConflict: 'empleado_id,proyecto_id' }
    );
    if (error) fallo(`No se pudo asignar ${e.email} a ${e.proyecto}: ` + error.message);
  }
  console.log('✓ asignaciones a proyectos reales');

  const oliver = await admin.from('perfil').select('id').eq('rol', 'admin_grupo').single();
  if (oliver.error) fallo('No se encontró la cuenta admin_grupo real: ' + oliver.error.message);

  // Imputaciones de septiembre 2026 (antes de hoy), estados mixtos -- vía service_role, nunca 'cerrada'.
  const LINEAS = [
    { e: creados[0], fecha: '2026-09-08', horas: 4, estado: 'borrador' },
    { e: creados[0], fecha: '2026-09-09', horas: 8, estado: 'enviada' },
    { e: creados[0], fecha: '2026-09-10', horas: 8, estado: 'aprobada' },
    { e: creados[1], fecha: '2026-09-15', horas: 6, estado: 'borrador' },
    { e: creados[1], fecha: '2026-09-16', horas: 8, estado: 'aprobada' },
    { e: creados[2], fecha: '2026-09-08', horas: 5, estado: 'enviada' },
    { e: creados[2], fecha: '2026-09-09', horas: 8, estado: 'aprobada' },
    { e: creados[3], fecha: '2026-09-17', horas: 3, estado: 'borrador' },
    { e: creados[4], fecha: '2026-09-08', horas: 8, estado: 'aprobada' },
    { e: creados[4], fecha: '2026-09-09', horas: 8, estado: 'enviada' },
  ];
  const imputacionIds = [];
  for (const l of LINEAS) {
    const fila = {
      empleado_id: l.e.id,
      proyecto_id: idProyecto(l.e.proyecto),
      subcategoria_id: idSubcat(l.e.subcategoria),
      fecha: l.fecha,
      horas: l.horas,
      descripcion: 'Datos de revisión (pack de estreno)',
      estado: l.estado,
      ...(l.estado === 'aprobada' ? { aprobado_por: oliver.data.id } : {}),
    };
    const { data, error } = await admin.from('imputacion').insert(fila).select('id').single();
    if (error) fallo(`No se pudo insertar imputación ${l.e.email} ${l.fecha}: ` + error.message);
    imputacionIds.push(data.id);
  }
  console.log(`✓ ${imputacionIds.length} imputaciones (borrador/computada/aprobada)`);

  // Ausencias: sesión real de la propia cuenta de prueba (nunca INSERT directo) -- una queda pendiente, otra se aprueba.
  const ausenciaIds = [];
  {
    const sMarina = await comoUsuario(creados[0].email);
    const { data: id1, error: e1 } = await sMarina.rpc('solicitar_ausencia', { p_tipo: 'vacaciones', p_inicio: '2026-09-29', p_fin: '2026-10-01', p_comentario: 'Pack de revisión: pendiente a propósito' });
    if (e1) fallo('solicitar_ausencia (Marina) falló: ' + e1.message);
    ausenciaIds.push(id1);
  }
  {
    const sDiego = await comoUsuario(creados[1].email);
    const { data: id2, error: e2 } = await sDiego.rpc('solicitar_ausencia', { p_tipo: 'otro_permiso', p_inicio: '2026-09-19', p_fin: '2026-09-19', p_comentario: 'Pack de revisión: aprobada a propósito' });
    if (e2) fallo('solicitar_ausencia (Diego) falló: ' + e2.message);
    ausenciaIds.push(id2);
    const sOliver = await comoUsuario('oliver.perez@wowinx.com');
    const { error: e3 } = await sOliver.rpc('aprobar_ausencia', { p_id: id2 });
    if (e3) fallo('aprobar_ausencia falló: ' + e3.message);
  }
  console.log('✓ 2 ausencias (1 pendiente, 1 aprobada) -- vía sesión real, no INSERT directo');

  // Tickets con hilo: cada uno vía sesión real del autor + un comentario de Oliver.
  const ticketIds = [];
  {
    const sCarla = await comoUsuario(creados[2].email);
    const { data: t1, error: e1 } = await sCarla.from('ticket').insert({ creado_por: creados[2].id, titulo: 'La ficha de proyecto no carga las tarifas', descripcion: 'Al abrir Web corporativa desde el panel, la pestaña de tarifas se queda en blanco.', tipo: 'incidencia' }).select('id, ref').single();
    if (e1) fallo('crear ticket (Carla) falló: ' + e1.message);
    ticketIds.push(t1.id);
    console.log(`✓ ticket ${t1.ref} (Carla)`);
  }
  {
    const sRuben = await comoUsuario(creados[3].email);
    const { data: t2, error: e2 } = await sRuben.from('ticket').insert({ creado_por: creados[3].id, titulo: 'Sugerencia: exportar el hilo de un ticket', descripcion: 'Sería útil poder copiar el hilo completo de un ticket resuelto.', tipo: 'mejora' }).select('id, ref').single();
    if (e2) fallo('crear ticket (Rubén) falló: ' + e2.message);
    ticketIds.push(t2.id);
    console.log(`✓ ticket ${t2.ref} (Rubén)`);
  }
  {
    const sOliver = await comoUsuario('oliver.perez@wowinx.com');
    for (const id of ticketIds) {
      const { error } = await sOliver.from('ticket_comentario').insert({ ticket_id: id, autor_id: oliver.data.id, texto: 'Lo reviso -- gracias por el aviso.' });
      if (error) fallo('comentar ticket falló: ' + error.message);
    }
  }
  console.log('✓ hilo (1 comentario de Oliver) en cada ticket');

  writeFileSync(
    ESTADO_PATH,
    JSON.stringify({ instaladoEn: new Date().toISOString(), proyecto: ref, empleados: creados.map((e) => ({ id: e.id, email: e.email, nombre: e.nombre })), imputacionIds, ausenciaIds, ticketIds }, null, 2)
  );

  console.log('\n=== Pack instalado ===');
  console.log('Cuentas (todas la MISMA contraseña, mostrada una sola vez):');
  for (const e of creados) console.log(`  ${e.email}`);
  console.log(`\n  CONTRASEÑA: ${password}`);
  console.log(`\nEstado guardado en ${ESTADO_PATH} (no se commitea). Para quitarlo todo: node scripts/pack-revision.mjs desinstalar --proyecto ${ref}`);
}

async function borrarEnOrden({ ticketIds, imputacionIds, ausenciaIds, perfilIds }) {
  if (ticketIds.length > 0) {
    const { error: e1 } = await admin.from('ticket_comentario').delete().in('ticket_id', ticketIds);
    if (e1) fallo('borrar ticket_comentario falló: ' + e1.message);
    const { error: e2 } = await admin.from('ticket').delete().in('id', ticketIds);
    if (e2) fallo('borrar ticket falló: ' + e2.message);
    const rs = await admin.rpc('ticket_ref_resincronizar');
    if (rs.error) fallo('ticket_ref_resincronizar falló: ' + rs.error.message);
    console.log(`✓ ${ticketIds.length} tickets + comentarios borrados; secuencia resincronizada (siguiente = T-${String(rs.data).padStart(3, '0')})`);
  }
  if (imputacionIds.length > 0) {
    const { error } = await admin.from('imputacion').delete().in('id', imputacionIds);
    if (error) fallo('borrar imputacion falló: ' + error.message);
    console.log(`✓ ${imputacionIds.length} imputaciones borradas`);
  }
  if (ausenciaIds.length > 0) {
    const { error } = await admin.from('ausencia').delete().in('id', ausenciaIds);
    if (error) fallo('borrar ausencia falló: ' + error.message);
    console.log(`✓ ${ausenciaIds.length} ausencias borradas`);
  }
  for (const id of perfilIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) fallo(`borrar cuenta ${id} falló: ` + error.message);
  }
  console.log(`✓ ${perfilIds.length} cuentas de prueba borradas (cascada a empleado_proyecto/proyecto_responsable/coste_empleado/perfil)`);
}

async function conteosFinales() {
  const T = { empresa: 3, departamento: 3, categoria: 4, subcategoria: 14, mapa_area: 6, mapa_item: 22, proyecto: 7, empresa_jornada: 21, festivo: 8, ajuste: 5, perfil: 1, empleado_proyecto: 0, proyecto_responsable: 0, imputacion: 0, ausencia: 0, periodo: 0, tarifa: 0, coste_empleado: 0, ticket: 0, ticket_comentario: 0, recordatorio_log: 0 };
  console.log('\n=== Conteos finales (deben coincidir con el estado de entrega) ===');
  let malas = 0;
  for (const [t, e] of Object.entries(T)) {
    const r = await admin.from(t).select('*', { count: 'exact', head: true });
    const ok = r.count === e;
    if (!ok) malas++;
    console.log(`${t.padEnd(20)} ${r.count} ${ok ? 'OK' : `<-- ESPERADO ${e}`}`);
  }
  console.log(malas === 0 ? '\nRESULTADO: producción vuelve exactamente al estado de entrega' : `\nRESULTADO: ${malas} DISCREPANCIAS`);
}

async function desinstalar() {
  if (args['por-patron']) {
    console.log('=== Desinstalar por patrón (respaldo) ===');
    const { data: perfiles, error } = await admin.from('perfil').select('id, email').like('email', PATRON_EMAIL);
    if (error) fallo('No se pudo buscar por patrón: ' + error.message);
    if (perfiles.length === 0) {
      console.log('Nada que desinstalar: no hay cuentas ' + PATRON_EMAIL);
      return;
    }
    const perfilIds = perfiles.map((p) => p.id);
    const [tk, im, au] = await Promise.all([
      admin.from('ticket').select('id, ref').in('creado_por', perfilIds),
      admin.from('imputacion').select('id').in('empleado_id', perfilIds),
      admin.from('ausencia').select('id').in('perfil_id', perfilIds),
    ]);
    console.log('Se borrarían:');
    console.log(`  ${perfiles.length} cuentas: ${perfiles.map((p) => p.email).join(', ')}`);
    console.log(`  ${tk.data?.length ?? 0} tickets: ${(tk.data ?? []).map((t) => t.ref).join(', ')}`);
    console.log(`  ${im.data?.length ?? 0} imputaciones, ${au.data?.length ?? 0} ausencias`);
    if (!args.si) fallo('Repite con --si para confirmar el borrado (esto NO es automático).');
    await borrarEnOrden({ ticketIds: (tk.data ?? []).map((t) => t.id), imputacionIds: (im.data ?? []).map((i) => i.id), ausenciaIds: (au.data ?? []).map((a) => a.id), perfilIds });
    if (existsSync(ESTADO_PATH)) unlinkSync(ESTADO_PATH);
    await conteosFinales();
    return;
  }

  if (!existsSync(ESTADO_PATH)) fallo(`No existe ${ESTADO_PATH}. Si el pack sí está instalado (archivo perdido), usa: desinstalar --proyecto ${ref} --por-patron --si`);
  const estado = JSON.parse(readFileSync(ESTADO_PATH, 'utf-8'));
  if (estado.proyecto !== ref) fallo(`El estado guardado es de otro proyecto (${estado.proyecto}), no de ${ref}.`);
  const noValido = estado.empleados.find((e) => !new RegExp('^prueba\\..*@wowinx\\.com$').test(e.email));
  if (noValido) fallo(`Email fuera de patrón en el estado, me niego a borrar a ciegas: ${noValido.email}`);

  console.log('=== Desinstalando pack de revisión (vía archivo de estado) ===');
  await borrarEnOrden({ ticketIds: estado.ticketIds, imputacionIds: estado.imputacionIds, ausenciaIds: estado.ausenciaIds, perfilIds: estado.empleados.map((e) => e.id) });
  unlinkSync(ESTADO_PATH);
  await conteosFinales();
}

if (accion === 'instalar') await instalar();
else await desinstalar();
