import { claveTexto, definir, errorDeFila, indexarPorNombre } from './nucleo';

interface FilaCategoria {
  fila: number;
  /** Nombre tal como viene en la fila (la primera aparición manda para categorías nuevas). */
  categoria: string;
  /** Categoría ya existente (id) o `null` si esta fila la crea. */
  categoriaId: string | null;
  departamentoId: string | null;
  tarea: string;
}

/**
 * Alta masiva del CATÁLOGO de categorías y tareas (sección Categorías › Importar / Exportar): UNA FILA POR TAREA. Las
 * categorías nuevas se crean con su departamento (como `useCategorias.crearCategoria`) y las tareas nuevas cuelgan de la
 * suya (`crearSubcategoria`). Son dos INSERT (categorías y luego tareas): el todo-o-nada es por COMPENSACIÓN, como en el
 * importador de usuarios: si falla el segundo, se borran las categorías creadas por este lote (aún sin tareas ni uso).
 * La RLS (`categoria_admin` / `subcategoria_admin`, solo admin_grupo) sigue actuando como segunda barrera.
 */
export const importadorCategorias = definir<FilaCategoria>({
  id: 'categorias',
  plantilla: {
    hoja: 'Categorías',
    columnas: [
      { cabecera: 'categoria', obligatoria: true, descripcion: 'Categoría a la que pertenece la tarea. Si no existe, se crea; si existe, la tarea se añade a ella.', ejemplo: 'Desarrollo' },
      {
        cabecera: 'departamento',
        obligatoria: false,
        descripcion: 'Departamento de la categoría, con el nombre exacto de uno existente. VACÍO = categoría global (transversal). En una categoría que ya existe debe COINCIDIR con el suyo.',
        ejemplo: '3B3',
      },
      { cabecera: 'tarea', obligatoria: true, descripcion: 'Nombre de la tarea (subcategoría). No puede existir ya en esa categoría (sin distinguir mayúsculas).', ejemplo: 'Backend' },
    ],
    notas: [
      'UNA FILA POR TAREA: para una categoría con tres tareas, escribe tres filas con el mismo nombre de categoría (y el mismo departamento).',
      'ALTA SOLAMENTE: crea categorías y tareas nuevas. Una tarea que ya existe en su categoría es un error de fila; no hay edición ni borrado masivos.',
      'EL IMPORTADOR NO REUBICA: si la categoría ya existe con OTRO departamento distinto del declarado en la fila (o global y la fila indica uno, o al revés), es un error. El departamento de una categoría existente se cambia en su sección, no aquí.',
      'Una misma categoría nueva debe declarar el MISMO departamento en todas sus filas.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error; corrígelos en el archivo y vuelve a subirlo.',
      'El archivo exportado (todo el catálogo: una fila por tarea) se puede reimportar tal cual: como todas esas tareas ya existen dará errores de duplicado y ninguna alta. Una categoría sin ninguna tarea no aparece en el export (no tiene fila).',
      'Solo el admin del grupo puede importar y exportar el catálogo.',
    ],
  },

  async analizar({ supabase }, filas) {
    const [categorias, subcategorias, departamentos] = await Promise.all([
      supabase.from('categoria').select('id, nombre, departamento_id'),
      supabase.from('subcategoria').select('categoria_id, nombre'),
      supabase.from('departamento').select('id, nombre'),
    ]);
    const idxDepartamento = indexarPorNombre(departamentos.data ?? []);
    const nombreDepartamento = new Map((departamentos.data ?? []).map((d) => [d.id as string, d.nombre as string]));
    const etiquetaDep = (id: string | null) => (id ? `el departamento '${nombreDepartamento.get(id) ?? id}'` : 'global (sin departamento)');

    const existente = new Map<string, { id: string; nombre: string; departamentoId: string | null }>();
    for (const c of categorias.data ?? []) existente.set(claveTexto(c.nombre), { id: c.id, nombre: c.nombre, departamentoId: c.departamento_id });
    const tareasExistentes = new Set((subcategorias.data ?? []).map((s) => `${s.categoria_id}|${claveTexto(s.nombre)}`));

    /** Categorías NUEVAS declaradas en el archivo: departamento de su primera fila (todas deben coincidir). */
    const nuevas = new Map<string, { departamentoId: string | null; fila: number }>();
    const tareasEnArchivo = new Map<string, number>();

    const validas: FilaCategoria[] = [];
    const errores = [];

    for (const { fila, valores: v } of filas) {
      const motivos: string[] = [];
      const categoria = (v.categoria ?? '').trim();
      const tarea = (v.tarea ?? '').trim();
      if (!categoria) motivos.push('falta la categoría');
      if (!tarea) motivos.push('falta la tarea');

      let departamentoId: string | null = null;
      let departamentoOk = true;
      if (v.departamento) {
        const id = idxDepartamento.get(claveTexto(v.departamento));
        if (id === undefined) {
          motivos.push(`departamento '${v.departamento}' no existe`);
          departamentoOk = false;
        } else if (id === null) {
          motivos.push(`departamento '${v.departamento}' es ambiguo (hay varios con ese nombre)`);
          departamentoOk = false;
        } else departamentoId = id;
      }

      let categoriaId: string | null = null;
      if (categoria) {
        const k = claveTexto(categoria);
        const ex = existente.get(k);
        if (ex) {
          categoriaId = ex.id;
          if (departamentoOk && ex.departamentoId !== departamentoId) {
            motivos.push(
              `la categoría '${ex.nombre}' ya existe y es ${etiquetaDep(ex.departamentoId)}, pero la fila declara ${etiquetaDep(departamentoId)}: el importador no reubica categorías (cámbialo en Categorías)`
            );
          }
          if (tarea && tareasExistentes.has(`${ex.id}|${claveTexto(tarea)}`)) motivos.push(`la tarea '${tarea}' ya existe en la categoría '${ex.nombre}' (este importador solo da de alta, no actualiza)`);
        } else if (departamentoOk) {
          const previa = nuevas.get(k);
          if (previa && previa.departamentoId !== departamentoId) {
            motivos.push(`la categoría nueva '${categoria}' declara ${etiquetaDep(departamentoId)}, pero en la fila ${previa.fila} declara ${etiquetaDep(previa.departamentoId)}`);
          } else if (!previa) nuevas.set(k, { departamentoId, fila });
        }
        if (tarea) {
          const claveTarea = `${k}|${claveTexto(tarea)}`;
          if (tareasEnArchivo.has(claveTarea)) motivos.push(`la tarea '${tarea}' está repetida en la categoría '${categoria}' dentro del archivo (también en la fila ${tareasEnArchivo.get(claveTarea)})`);
          else tareasEnArchivo.set(claveTarea, fila);
        }
      }

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, categoria, categoriaId, departamentoId, tarea });
    }
    return { validas, errores };
  },

  async ejecutar({ supabase }, validas) {
    // 1) Categorías nuevas (una por nombre; la primera fila manda para mayúsculas y departamento).
    const nuevas = new Map<string, { nombre: string; departamento_id: string | null }>();
    for (const f of validas) {
      const k = claveTexto(f.categoria);
      if (!f.categoriaId && !nuevas.has(k)) nuevas.set(k, { nombre: f.categoria, departamento_id: f.departamentoId });
    }
    const idPorClave = new Map<string, string>();
    let creadas: string[] = [];
    if (nuevas.size > 0) {
      const { data, error } = await supabase.from('categoria').insert([...nuevas.values()]).select('id, nombre');
      if (error) return { error: `No se pudieron crear las categorías: ${error.message}. No se ha importado ninguna fila.` };
      creadas = (data ?? []).map((c) => c.id);
      for (const c of data ?? []) idPorClave.set(claveTexto(c.nombre), c.id);
    }

    // 2) Tareas. Si falla, se compensa borrando las categorías que acaba de crear este lote.
    const { error } = await supabase.from('subcategoria').insert(
      validas.map((f) => ({ categoria_id: f.categoriaId ?? idPorClave.get(claveTexto(f.categoria))!, nombre: f.tarea }))
    );
    if (!error) return { error: null };
    let revertido = 'El lote se ha revertido: no se ha creado ninguna categoría ni tarea.';
    if (creadas.length > 0) {
      const { error: errBorrado } = await supabase.from('categoria').delete().in('id', creadas);
      if (errBorrado) revertido = `ATENCIÓN: no se pudieron revertir ${creadas.length} categoría(s) creadas (ids: ${creadas.join(', ')}); bórralas a mano desde Categorías.`;
    }
    return { error: `No se pudieron crear las tareas: ${error.message}. ${revertido}` };
  },
});
