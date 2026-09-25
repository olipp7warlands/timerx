import { claveTexto, definir, errorDeFila } from './nucleo';

interface FilaEmpresa {
  fila: number;
  nombre: string;
  cif: string | null;
  areaId: string | null;
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
    ],
    notas: [
      'ALTA SOLAMENTE: este importador crea empresas nuevas. Un nombre que ya existe es un error de fila (no se actualiza ni se pisa); no hay edición ni borrado masivos.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error; corrígelos en el archivo y vuelve a subirlo.',
      'JORNADA: cada empresa importada nace con su jornada semanal por defecto (la de la herramienta, editable después en Calendario → Jornada semanal), igual que una empresa creada desde el formulario.',
      'Las empresas nacen ACTIVAS. La columna «activa» del archivo exportado se ignora al importar.',
      'El archivo exportado desde esta sección se puede reimportar tal cual: como todas esas empresas ya existen dará errores de duplicado y ninguna alta.',
      'Solo el admin del grupo puede importar y exportar empresas.',
    ],
  },

  async analizar({ supabase }, filas) {
    const [empresas, areas] = await Promise.all([supabase.from('empresa').select('nombre, cif'), supabase.from('mapa_area').select('id, nombre, activa')]);
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

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, nombre, cif: cif || null, areaId });
    }
    return { validas, errores };
  },

  /** Un solo INSERT masivo = una sola transacción: todo o nada. El trigger de la 019 siembra la jornada de cada empresa. */
  async ejecutar({ supabase }, validas) {
    const { error } = await supabase.from('empresa').insert(validas.map((f) => ({ nombre: f.nombre, cif: f.cif, area_id: f.areaId })));
    return { error: error ? `No se pudieron crear las empresas: ${error.message}. No se ha importado ninguna fila.` : null };
  },
});
