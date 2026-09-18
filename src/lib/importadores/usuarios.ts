import { createClient as createServiceClient } from '@supabase/supabase-js';
import { altaUsuario, modoAltaDesdeEntorno, type AltaUsuarioInput } from '@/lib/usuarios/alta';
import { claveTexto, definir, errorDeFila } from './nucleo';

const ROLES: AltaUsuarioInput['rol'][] = ['empleado', 'responsable_proyecto', 'admin_empresa', 'admin_grupo'];
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FilaUsuario extends AltaUsuarioInput {
  fila: number;
}

/** Catálogo nombre -> id (sin distinguir mayúsculas). Un nombre repetido es ambiguo: no se puede resolver por nombre. */
function indexar(filas: { id: string; nombre: string }[]) {
  const mapa = new Map<string, string | null>();
  for (const f of filas) {
    const k = claveTexto(f.nombre);
    mapa.set(k, mapa.has(k) ? null : f.id);
  }
  return mapa;
}

export const importadorUsuarios = definir<FilaUsuario>({
  id: 'usuarios',
  ignoradas: ['activo'],
  plantilla: {
    hoja: 'Usuarios',
    columnas: [
      { cabecera: 'nombre', obligatoria: true, descripcion: 'Nombre y apellidos de la persona.', ejemplo: 'Lucía Prieto' },
      { cabecera: 'email', obligatoria: true, descripcion: 'Correo de acceso. Es el identificador único de la persona: no puede existir ya.', ejemplo: 'lucia.prieto@empresa.com' },
      { cabecera: 'empresa', obligatoria: true, descripcion: 'Empresa empleadora, con el nombre EXACTO de una empresa que ya existe en la herramienta.', ejemplo: 'Wowinx SL' },
      { cabecera: 'departamento', obligatoria: false, descripcion: 'Departamento, con el nombre exacto de uno existente. Vacío = sin departamento.', ejemplo: '3B3' },
      { cabecera: 'categoria', obligatoria: false, descripcion: 'Categoría por defecto (tarifa y precarga), con el nombre exacto de una existente. Vacío = sin categoría.', ejemplo: 'Desarrollo' },
      {
        cabecera: 'rol',
        obligatoria: false,
        descripcion: 'Rol de la persona. Vacío = empleado.',
        admitidos: 'empleado · responsable_proyecto · admin_empresa · admin_grupo',
        ejemplo: 'empleado',
      },
    ],
    notas: [
      'ALTA SOLAMENTE: este importador crea usuarios nuevos. Un email que ya existe es un error de fila (no se actualiza ni se pisa); la edición masiva no está incluida.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error; corrígelos en el archivo y vuelve a subirlo.',
      'El archivo exportado desde la sección Usuarios se puede reimportar tal cual: la columna «activo» se ignora, y como todos esos emails ya existen dará errores de duplicado y ninguna alta.',
      'Acceso: las cuentas se crean confirmadas y SIN contraseña, sin enviar ningún correo (la herramienta no envía email). El acceso se da con «Restablecer contraseña» en la ficha de cada usuario, que muestra una contraseña temporal una sola vez para entregarla en mano; después la persona la cambia desde el menú de su avatar.',
    ],
  },

  async analizar({ supabase }, filas) {
    const [empresas, departamentos, categorias, perfiles] = await Promise.all([
      supabase.from('empresa').select('id, nombre'),
      supabase.from('departamento').select('id, nombre'),
      supabase.from('categoria').select('id, nombre'),
      supabase.from('perfil').select('email'),
    ]);
    const idxEmpresa = indexar(empresas.data ?? []);
    const idxDepartamento = indexar(departamentos.data ?? []);
    const idxCategoria = indexar(categorias.data ?? []);
    const existentes = new Set((perfiles.data ?? []).map((p) => claveTexto(p.email)));
    const enArchivo = new Map<string, number>();

    const validas: FilaUsuario[] = [];
    const errores = [];

    for (const { fila, valores: v } of filas) {
      const motivos: string[] = [];
      const nombre = v.nombre ?? '';
      const email = claveTexto(v.email ?? '');

      if (!nombre) motivos.push('falta el nombre');
      if (!email) motivos.push('falta el email');
      else if (!RE_EMAIL.test(email)) motivos.push(`email '${v.email}' no es una dirección válida`);
      else if (existentes.has(email)) motivos.push(`el email '${email}' ya existe (este importador solo da de alta, no actualiza)`);
      else if (enArchivo.has(email)) motivos.push(`el email '${email}' está repetido en el archivo (también en la fila ${enArchivo.get(email)})`);
      if (email && !enArchivo.has(email)) enArchivo.set(email, fila);

      let empresaId = '';
      if (!v.empresa) motivos.push('falta la empresa');
      else {
        const id = idxEmpresa.get(claveTexto(v.empresa));
        if (id === undefined) motivos.push(`empresa '${v.empresa}' no existe`);
        else if (id === null) motivos.push(`empresa '${v.empresa}' es ambigua (hay varias con ese nombre)`);
        else empresaId = id;
      }

      let departamentoId: string | null = null;
      if (v.departamento) {
        const id = idxDepartamento.get(claveTexto(v.departamento));
        if (id === undefined) motivos.push(`departamento '${v.departamento}' no existe`);
        else if (id === null) motivos.push(`departamento '${v.departamento}' es ambiguo (hay varios con ese nombre)`);
        else departamentoId = id;
      }

      let categoriaId: string | null = null;
      if (v.categoria) {
        const id = idxCategoria.get(claveTexto(v.categoria));
        if (id === undefined) motivos.push(`categoría '${v.categoria}' no existe`);
        else if (id === null) motivos.push(`categoría '${v.categoria}' es ambigua (hay varias con ese nombre)`);
        else categoriaId = id;
      }

      const rolTexto = claveTexto(v.rol ?? '') || 'empleado';
      const rol = ROLES.find((r) => r === rolTexto);
      if (!rol) motivos.push(`rol '${v.rol}' no válido (admitidos: ${ROLES.join(', ')})`);

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, email, nombre, empresaId, departamentoId, categoriaId, rol: rol! });
    }
    return { validas, errores };
  },

  /**
   * Misma mutación que `invitarUsuario` (`altaUsuario`: auth + perfil). Un usuario de auth no se puede crear
   * dentro de una transacción de Postgres, así que el todo-o-nada es por COMPENSACIÓN: ante el primer fallo se
   * borran las cuentas creadas en este lote (el perfil cae en cascada desde auth.users).
   */
  async ejecutar(_ctx, validas) {
    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const modo = modoAltaDesdeEntorno();
    const creadas: string[] = [];

    for (const f of validas) {
      const { userId, error } = await altaUsuario(admin, f, modo);
      if (userId) creadas.push(userId);
      if (error) {
        const fallidas: string[] = [];
        for (const id of creadas) {
          const { error: errBorrado } = await admin.auth.admin.deleteUser(id);
          if (errBorrado) fallidas.push(id);
        }
        const revertido = fallidas.length
          ? `ATENCIÓN: no se pudieron revertir ${fallidas.length} cuenta(s) (ids: ${fallidas.join(', ')}); bórralas a mano.`
          : 'El lote se ha revertido: no se ha creado ningún usuario.';
        return { error: `Fila ${f.fila} (${f.email}): ${error}. ${revertido}` };
      }
    }
    return { error: null };
  },
});
