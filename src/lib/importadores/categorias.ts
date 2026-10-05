import { claveTexto, definir, errorDeFila, indexarPorNombre } from './nucleo';

interface FilaEspecialidad {
  fila: number;
  /** Categoría ESPEJO del departamento (de ella cuelga la especialidad: `subcategoria.categoria_id`). */
  espejoId: string;
  especialidad: string;
}

/** Error claro para quien sube la plantilla ANTERIOR del catálogo (categoría · departamento · tarea). Ruptura declarada (v2.0, D8). */
const PLANTILLA_ANTERIOR =
  'Esta es la plantilla ANTERIOR del catálogo (categoría · departamento · tarea). Desde v2.0 la categoría es el propio departamento y la tarea se llama especialidad: descarga la plantilla nueva (departamento · especialidad) y vuelve a subir tus filas.';

/**
 * Alta masiva de ESPECIALIDADES (sección Departamentos › Importar / Exportar), v2.0: UNA FILA POR ESPECIALIDAD, con su departamento.
 * Una especialidad es una `subcategoria` bajo la categoría ESPEJO de su departamento. Es UN solo INSERT: el todo-o-nada es el de Postgres
 * (sin compensación). La RLS (`subcategoria_admin`, solo admin_grupo) sigue actuando como segunda barrera.
 * Los departamentos NO se crean aquí (se dan de alta desde la sección, con su color y sus empresas): un departamento desconocido es un error.
 */
export const importadorCategorias = definir<FilaEspecialidad>({
  id: 'categorias',
  plantilla: {
    hoja: 'Especialidades',
    columnas: [
      { cabecera: 'departamento', obligatoria: true, descripcion: 'Departamento al que pertenece la especialidad, con el nombre exacto de uno existente y activo.', ejemplo: 'Desarrollo' },
      {
        cabecera: 'especialidad',
        obligatoria: true,
        descripcion: 'Nombre de la especialidad (lo que se imputa). No puede existir ya en ese departamento (sin distinguir mayúsculas).',
        ejemplo: 'Backend',
      },
    ],
    // Cabeceras de la plantilla anterior: se rechazan con un mensaje claro (no con el genérico «columna desconocida»).
    antiguas: { categoria: PLANTILLA_ANTERIOR, tarea: PLANTILLA_ANTERIOR },
    notas: [
      'UNA FILA POR ESPECIALIDAD: para un departamento con tres especialidades, escribe tres filas con el mismo nombre de departamento.',
      'ALTA SOLAMENTE: crea especialidades nuevas. Una que ya existe en su departamento es un error de fila; no hay edición ni borrado masivos.',
      'LOS DEPARTAMENTOS NO SE CREAN AQUÍ: deben existir ya (se dan de alta en la sección Departamentos, con su color y sus empresas) y estar activos.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error; corrígelos en el archivo y vuelve a subirlo.',
      'El archivo exportado (todo el catálogo: una fila por especialidad) se puede reimportar tal cual: como todas esas especialidades ya existen dará errores de duplicado y ninguna alta.',
      'Si tienes un archivo con la plantilla ANTERIOR (categoría · departamento · tarea), no se importa: descarga esta plantilla nueva y pasa tus filas (la categoría es ahora el departamento).',
      'Solo el admin del grupo puede importar y exportar el catálogo.',
    ],
  },

  async analizar({ supabase }, filas) {
    const [departamentos, categorias, subcategorias] = await Promise.all([
      supabase.from('departamento').select('id, nombre, activo'),
      supabase.from('categoria').select('id, departamento_id'),
      supabase.from('subcategoria').select('categoria_id, nombre'),
    ]);
    const idxDepartamento = indexarPorNombre(departamentos.data ?? []);
    const activoPorId = new Map((departamentos.data ?? []).map((d) => [d.id as string, d.activo as boolean]));
    const espejoPorDepartamento = new Map((categorias.data ?? []).map((c) => [c.departamento_id as string, c.id as string]));
    const existentes = new Set((subcategorias.data ?? []).map((s) => `${s.categoria_id}|${claveTexto(s.nombre)}`));
    const enArchivo = new Map<string, number>();

    const validas: FilaEspecialidad[] = [];
    const errores = [];

    for (const { fila, valores: v } of filas) {
      const motivos: string[] = [];
      const especialidad = (v.especialidad ?? '').trim();
      if (!especialidad) motivos.push('falta la especialidad');

      let espejoId = '';
      if (!v.departamento) motivos.push('falta el departamento');
      else {
        const id = idxDepartamento.get(claveTexto(v.departamento));
        if (id === undefined) motivos.push(`el departamento '${v.departamento}' no existe (créalo antes en la sección Departamentos)`);
        else if (id === null) motivos.push(`el departamento '${v.departamento}' es ambiguo (hay varios con ese nombre)`);
        else if (!activoPorId.get(id)) motivos.push(`el departamento '${v.departamento}' está inactivo`);
        else {
          const espejo = espejoPorDepartamento.get(id);
          if (!espejo) motivos.push(`el departamento '${v.departamento}' no tiene su categoría espejo (avisa a soporte)`);
          else espejoId = espejo;
        }
      }

      if (espejoId && especialidad) {
        const clave = `${espejoId}|${claveTexto(especialidad)}`;
        if (existentes.has(clave)) motivos.push(`la especialidad '${especialidad}' ya existe en el departamento '${v.departamento}'`);
        else if (enArchivo.has(clave)) motivos.push(`la especialidad '${especialidad}' está repetida en el departamento '${v.departamento}' dentro del archivo (también en la fila ${enArchivo.get(clave)})`);
        else enArchivo.set(clave, fila);
      }

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, espejoId, especialidad });
    }
    return { validas, errores };
  },

  async ejecutar({ supabase }, validas) {
    const { error } = await supabase.from('subcategoria').insert(validas.map((f) => ({ categoria_id: f.espejoId, nombre: f.especialidad })));
    return { error: error ? `No se pudieron crear las especialidades: ${error.message}. No se ha importado ninguna fila.` : null };
  },
});
