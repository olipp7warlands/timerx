import { claveTexto, definir, errorDeFila } from './nucleo';

interface FilaEmpresa {
  fila: number;
  nombre: string;
  cif: string | null;
  areaId: string | null;
  /** Departamentos de la empresa (`empresa_departamento`). Vacío en el archivo = TODOS los activos (como el alta desde el formulario). */
  departamentoIds: string[];
}

/**
 * Alta masiva de EMPRESAS (sección Empresas › Importar / Exportar). Misma mutación que el alta de la UI
 * (`useEmpresas.crear`: INSERT de nombre, cif y área), en un solo INSERT masivo = una sola transacción: todo o nada por
 * construcción. Cada empresa nace con su jornada semanal: la siembra el trigger `empresa_jornada_defecto` (019) sea cual
 * sea la vía de alta. La RLS (`empresa_admin`, solo admin_grupo) sigue actuando como segunda barrera.
 */
export const importadorEmpresas = definir<FilaEmpresa>({
  id: 'empresas',
  ignoradas: ['activa'],
  plantilla: {
    hoja: 'Empresas',
    columnas: [
      { cabecera: 'nombre', obligatoria: true, descripcion: 'Nombre de la empresa. No puede coincidir con el de una empresa que ya existe (sin distinguir mayúsculas).', ejemplo: 'Nueva Empresa SL' },
      { cabecera: 'cif', obligatoria: false, descripcion: 'CIF/NIF de la empresa. Vacío = sin CIF (se puede fijar después desde la ficha). Si se indica, no puede repetirse.', ejemplo: 'B-12345678' },
      {
        cabecera: 'tipologia',
        obligatoria: false,
        descripcion: 'Tipología de la empresa: el NOMBRE EXACTO de un área ACTIVA del Mapa del grupo. Vacío = sin tipología.',
        admitidos: 'Un área del Mapa (Mapa → Áreas)',
        ejemplo: 'Tecnología',
      },
      {
        cabecera: 'departamentos',
        obligatoria: false,
        descripcion: 'Departamentos que existen en la empresa: los NOMBRES EXACTOS de departamentos activos, separados por «;». Vacío = TODOS los departamentos activos.',
        admitidos: 'Departamentos activos (sección Departamentos), separados por «;»',
        ejemplo: 'Desarrollo; Diseño; Administración y Finanzas',
      },
    ],
    notas: [
      'ALTA SOLAMENTE: este importador crea empresas nuevas. Un nombre que ya existe es un error de fila (no se actualiza ni se pisa); no hay edición ni borrado masivos.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error; corrígelos en el archivo y vuelve a subirlo.',
      'DEPARTAMENTOS: definen qué departamentos existen en la empresa y, con ello, qué especialidades pueden imputar sus profesionales. Si dejas la columna vacía, la empresa nace con TODOS los departamentos activos (se pueden recortar después desde su ficha).',
      'JORNADA: cada empresa importada nace con su jornada semanal por defecto (la de la herramienta, editable después en Calendario → Jornada semanal), igual que una empresa creada desde el formulario.',
      'Las empresas nacen ACTIVAS. La columna «activa» del archivo exportado se ignora al importar.',
      'El archivo exportado desde esta sección se puede reimportar tal cual: como todas esas empresas ya existen dará errores de duplicado y ninguna alta.',
      'Solo el admin del grupo puede importar y exportar empresas.',
    ],
  },

  async analizar({ supabase }, filas) {
    const [empresas, areas, departamentos] = await Promise.all([
      supabase.from('empresa').select('nombre, cif'),
      supabase.from('mapa_area').select('id, nombre, activa'),
      supabase.from('departamento').select('id, nombre, activo'),
    ]);
    const deptoPorNombre = new Map<string, { id: string; activo: boolean } | null>();
    for (const d of departamentos.data ?? []) {
      const k = claveTexto(d.nombre);
      deptoPorNombre.set(k, deptoPorNombre.has(k) ? null : { id: d.id, activo: d.activo });
    }
    const todosActivos = (departamentos.data ?? []).filter((d) => d.activo).map((d) => d.id as string);
    const nombres = new Set((empresas.data ?? []).map((e) => claveTexto(e.nombre)));
    const cifs = new Map((empresas.data ?? []).filter((e) => e.cif).map((e) => [claveTexto(e.cif!), e.nombre as string]));
    const areaPorNombre = new Map<string, { id: string; activa: boolean } | null>();
    for (const a of areas.data ?? []) {
      const k = claveTexto(a.nombre);
      areaPorNombre.set(k, areaPorNombre.has(k) ? null : { id: a.id, activa: a.activa });
    }
    const nombreEnArchivo = new Map<string, number>();
    const cifEnArchivo = new Map<string, number>();

    const validas: FilaEmpresa[] = [];
    const errores = [];

    for (const { fila, valores: v } of filas) {
      const motivos: string[] = [];
      const nombre = (v.nombre ?? '').trim();
      const cif = (v.cif ?? '').trim();

      if (!nombre) motivos.push('falta el nombre');
      else {
        const k = claveTexto(nombre);
        if (nombres.has(k)) motivos.push(`la empresa '${nombre}' ya existe (este importador solo da de alta, no actualiza)`);
        else if (nombreEnArchivo.has(k)) motivos.push(`el nombre '${nombre}' está repetido en el archivo (también en la fila ${nombreEnArchivo.get(k)})`);
        if (!nombreEnArchivo.has(k)) nombreEnArchivo.set(k, fila);
      }

      if (cif) {
        const k = claveTexto(cif);
        if (cifs.has(k)) motivos.push(`el CIF '${cif}' ya lo tiene la empresa '${cifs.get(k)}'`);
        else if (cifEnArchivo.has(k)) motivos.push(`el CIF '${cif}' está repetido en el archivo (también en la fila ${cifEnArchivo.get(k)})`);
        if (!cifEnArchivo.has(k)) cifEnArchivo.set(k, fila);
      }

      let areaId: string | null = null;
      if (v.tipologia) {
        const a = areaPorNombre.get(claveTexto(v.tipologia));
        if (a === undefined) motivos.push(`tipología '${v.tipologia}' no existe (debe ser el nombre exacto de un área del Mapa)`);
        else if (a === null) motivos.push(`tipología '${v.tipologia}' es ambigua (hay varias áreas con ese nombre)`);
        else if (!a.activa) motivos.push(`tipología '${v.tipologia}' existe pero está inactiva en el Mapa`);
        else areaId = a.id;
      }

      // Departamentos de la empresa: lista separada por «;» (vacía = todos los activos).
      const departamentoIds: string[] = [];
      const nombresDeptos = (v.departamentos ?? '').split(';').map((x) => x.trim()).filter(Boolean);
      for (const n of nombresDeptos) {
        const d = deptoPorNombre.get(claveTexto(n));
        if (d === undefined) motivos.push(`departamento '${n}' no existe (créalo antes en la sección Departamentos)`);
        else if (d === null) motivos.push(`departamento '${n}' es ambiguo (hay varios con ese nombre)`);
        else if (!d.activo) motivos.push(`departamento '${n}' está inactivo`);
        else if (!departamentoIds.includes(d.id)) departamentoIds.push(d.id);
      }

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, nombre, cif: cif || null, areaId, departamentoIds: nombresDeptos.length > 0 ? departamentoIds : todosActivos });
    }
    return { validas, errores };
  },

  /**
   * INSERT masivo de empresas (una transacción: todo o nada; el trigger de la 019 siembra la jornada de cada una) y, después, sus
   * departamentos (`empresa_departamento`). Son dos INSERT: si falla el segundo se COMPENSA borrando las empresas de este lote
   * (con su jornada y sus enlaces), como en el importador de usuarios.
   */
  async ejecutar({ supabase }, validas) {
    const { data, error } = await supabase.from('empresa').insert(validas.map((f) => ({ nombre: f.nombre, cif: f.cif, area_id: f.areaId }))).select('id, nombre');
    if (error) return { error: `No se pudieron crear las empresas: ${error.message}. No se ha importado ninguna fila.` };
    const idPorNombre = new Map((data ?? []).map((e) => [claveTexto(e.nombre), e.id as string]));
    const enlaces = validas.flatMap((f) => f.departamentoIds.map((d) => ({ empresa_id: idPorNombre.get(claveTexto(f.nombre))!, departamento_id: d })));
    if (enlaces.length === 0) return { error: null };
    const { error: eEnlaces } = await supabase.from('empresa_departamento').insert(enlaces);
    if (!eEnlaces) return { error: null };
    const ids = [...idPorNombre.values()];
    await supabase.from('empresa_departamento').delete().in('empresa_id', ids);
    await supabase.from('empresa_jornada').delete().in('empresa_id', ids);
    const { error: eBorrado } = await supabase.from('empresa').delete().in('id', ids);
    const revertido = eBorrado ? `ATENCIÓN: no se pudieron revertir ${ids.length} empresa(s) (ids: ${ids.join(', ')}); bórralas a mano.` : 'El lote se ha revertido: no se ha creado ninguna empresa.';
    return { error: `No se pudieron asignar los departamentos: ${eEnlaces.message}. ${revertido}` };
  },
});
