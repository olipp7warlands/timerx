import { claveTexto, definir, errorDeFila } from './nucleo';

interface FilaProyecto {
  fila: number;
  empresaId: string;
  codigo: string;
  nombre: string;
  areaId: string | null;
}

/**
 * Alta masiva de PROYECTOS (sección Proyectos › Importar / Exportar). Misma mutación que el alta de la UI
 * (`useProyectosAdmin.crear`), en un solo INSERT masivo = una sola transacción: todo o nada. Tipología: si la fila la trae,
 * esa (área ACTIVA del Mapa); VACÍA = hereda la de la empresa en el momento de importar (COPIA, no referencia viva), como
 * «Heredar de la empresa» en el alta de la UI. La RLS (`proyecto_admin`) sigue actuando como segunda barrera.
 */
export const importadorProyectos = definir<FilaProyecto>({
  id: 'proyectos',
  ignoradas: ['estado'],
  plantilla: {
    hoja: 'Proyectos',
    columnas: [
      { cabecera: 'empresa', obligatoria: true, descripcion: 'Empresa que recibe el servicio, con el nombre EXACTO de una empresa ACTIVA que ya existe.', ejemplo: 'Wowinx SL' },
      { cabecera: 'codigo', obligatoria: true, descripcion: 'Código corto del proyecto. Único dentro de su empresa (sin distinguir mayúsculas).', ejemplo: 'XIM' },
      { cabecera: 'nombre', obligatoria: true, descripcion: 'Nombre del proyecto.', ejemplo: 'Ximeras' },
      {
        cabecera: 'tipologia',
        obligatoria: false,
        descripcion: 'Tipología del proyecto: el NOMBRE EXACTO de un área ACTIVA del Mapa. VACÍO = hereda la tipología de su empresa.',
        admitidos: 'Un área del Mapa (Mapa → Áreas) o vacío',
        ejemplo: 'Deportes',
      },
    ],
    notas: [
      'ALTA SOLAMENTE: este importador crea proyectos nuevos. Un código que ya existe en esa empresa es un error de fila (no se actualiza ni se pisa); no hay edición ni borrado masivos.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error; corrígelos en el archivo y vuelve a subirlo.',
      'HERENCIA: dejar «tipologia» vacía copia la tipología que tenga la empresa en ese momento (como «Heredar de la empresa» al crear un proyecto). Para dejar un proyecto SIN tipología, cámbialo después en su ficha.',
      'Las empresas deben existir ya: importa primero las empresas nuevas y después sus proyectos. Los proyectos nacen ACTIVOS; la columna «estado» del archivo exportado se ignora al importar.',
      'El archivo exportado desde esta sección se puede reimportar tal cual: como todos esos proyectos ya existen dará errores de duplicado y ninguna alta.',
      'Solo el admin del grupo puede importar y exportar proyectos.',
    ],
  },

  async analizar({ supabase }, filas) {
    const [empresas, proyectos, areas] = await Promise.all([
      supabase.from('empresa').select('id, nombre, activa, area_id'),
      supabase.from('proyecto').select('empresa_id, codigo'),
      supabase.from('mapa_area').select('id, nombre, activa'),
    ]);
    const empresaPorNombre = new Map<string, { id: string; activa: boolean; areaId: string | null } | null>();
    for (const e of empresas.data ?? []) {
      const k = claveTexto(e.nombre);
      empresaPorNombre.set(k, empresaPorNombre.has(k) ? null : { id: e.id, activa: e.activa, areaId: e.area_id });
    }
    const areaPorNombre = new Map<string, { id: string; activa: boolean } | null>();
    for (const a of areas.data ?? []) {
      const k = claveTexto(a.nombre);
      areaPorNombre.set(k, areaPorNombre.has(k) ? null : { id: a.id, activa: a.activa });
    }
    const existentes = new Set((proyectos.data ?? []).map((p) => `${p.empresa_id}|${claveTexto(p.codigo)}`));
    const enArchivo = new Map<string, number>();

    const validas: FilaProyecto[] = [];
    const errores = [];

    for (const { fila, valores: v } of filas) {
      const motivos: string[] = [];
      const codigo = (v.codigo ?? '').trim();
      const nombre = (v.nombre ?? '').trim();

      let empresa: { id: string; areaId: string | null } | null = null;
      if (!v.empresa) motivos.push('falta la empresa');
      else {
        const e = empresaPorNombre.get(claveTexto(v.empresa));
        if (e === undefined) motivos.push(`empresa '${v.empresa}' no existe`);
        else if (e === null) motivos.push(`empresa '${v.empresa}' es ambigua (hay varias con ese nombre)`);
        else if (!e.activa) motivos.push(`empresa '${v.empresa}' está inactiva: no admite proyectos nuevos`);
        else empresa = e;
      }

      if (!codigo) motivos.push('falta el código');
      if (!nombre) motivos.push('falta el nombre');

      if (empresa && codigo) {
        const clave = `${empresa.id}|${claveTexto(codigo)}`;
        if (existentes.has(clave)) motivos.push(`el código '${codigo}' ya existe en '${v.empresa}' (este importador solo da de alta, no actualiza)`);
        else if (enArchivo.has(clave)) motivos.push(`el código '${codigo}' está repetido en '${v.empresa}' dentro del archivo (también en la fila ${enArchivo.get(clave)})`);
        if (!enArchivo.has(clave)) enArchivo.set(clave, fila);
      }

      let areaId: string | null = empresa?.areaId ?? null; // vacío = hereda la de la empresa (copia)
      if (v.tipologia) {
        const a = areaPorNombre.get(claveTexto(v.tipologia));
        if (a === undefined) motivos.push(`tipología '${v.tipologia}' no existe (debe ser el nombre exacto de un área del Mapa)`);
        else if (a === null) motivos.push(`tipología '${v.tipologia}' es ambigua (hay varias áreas con ese nombre)`);
        else if (!a.activa) motivos.push(`tipología '${v.tipologia}' existe pero está inactiva en el Mapa`);
        else areaId = a.id;
      }

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, empresaId: empresa!.id, codigo, nombre, areaId });
    }
    return { validas, errores };
  },

  /** Un solo INSERT masivo = una sola transacción: todo o nada. */
  async ejecutar({ supabase }, validas) {
    const { error } = await supabase.from('proyecto').insert(validas.map((f) => ({ empresa_id: f.empresaId, codigo: f.codigo, nombre: f.nombre, area_id: f.areaId })));
    return { error: error ? `No se pudieron crear los proyectos: ${error.message}. No se ha importado ninguna fila.` : null };
  },
});
