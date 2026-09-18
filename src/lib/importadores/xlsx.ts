import ExcelJS from 'exceljs';

export interface ColumnaPlantilla {
  cabecera: string;
  obligatoria: boolean;
  /** Qué va en la columna. */
  descripcion: string;
  /** Valores admitidos (enums, formatos). */
  admitidos?: string;
  ejemplo?: string;
  /** Formatea la columna como fecha ISO en la hoja 1 para que Excel no la convierta a otro formato. */
  fecha?: boolean;
}

export interface DefinicionPlantilla {
  hoja: string;
  columnas: ColumnaPlantilla[];
  /** Párrafos libres al pie de la hoja "Instrucciones" (reglas del importador). */
  notas: string[];
}

const MAX_FILAS = 2000;

function aBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return wb.xlsx.writeBuffer().then((b) => Buffer.from(b));
}

/**
 * Hoja 1: SOLO cabeceras exactas (sin fila de ejemplo: nadie la borra y acaba importada).
 * Hoja 2 "Instrucciones": qué va en cada columna, valores admitidos y ejemplos.
 */
export async function generarPlantilla(def: DefinicionPlantilla): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(def.hoja);
  ws.addRow(def.columnas.map((c) => c.cabecera));
  ws.getRow(1).font = { bold: true };
  def.columnas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(18, c.cabecera.length + 6);
    if (c.fecha) col.numFmt = 'yyyy-mm-dd';
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const ins = wb.addWorksheet('Instrucciones');
  ins.addRow(['Columna', 'Obligatoria', 'Qué va en ella', 'Valores admitidos', 'Ejemplo']);
  ins.getRow(1).font = { bold: true };
  for (const c of def.columnas) {
    ins.addRow([c.cabecera, c.obligatoria ? 'Sí' : 'No (opcional)', c.descripcion, c.admitidos ?? '', c.ejemplo ?? '']);
  }
  ins.addRow([]);
  for (const nota of def.notas) ins.addRow([nota]);
  [16, 16, 60, 42, 28].forEach((w, i) => (ins.getColumn(i + 1).width = w));
  ins.eachRow((row) => row.eachCell((cell) => (cell.alignment = { vertical: 'top', wrapText: true })));
  return aBuffer(wb);
}

/** Exporta datos con cabeceras exactas de la plantilla (sirve de punto de partida editable para el import). */
export async function generarExport(hoja: string, cabeceras: string[], filas: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(hoja);
  ws.addRow(cabeceras);
  ws.getRow(1).font = { bold: true };
  for (const f of filas) ws.addRow(f);
  cabeceras.forEach((c, i) => (ws.getColumn(i + 1).width = Math.max(16, c.length + 6)));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return aBuffer(wb);
}

export interface FilaLeida {
  /** Número de fila en Excel. */
  fila: number;
  valores: Record<string, string>;
}

function normalizarCabecera(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function celdaATexto(valor: ExcelJS.CellValue): string {
  if (valor == null) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if ('result' in valor && valor.result != null) return celdaATexto(valor.result as ExcelJS.CellValue);
    if ('richText' in valor) return valor.richText.map((t) => t.text).join('').trim();
    if ('text' in valor) return String(valor.text).trim();
    return '';
  }
  return String(valor).trim();
}

/**
 * Lee la PRIMERA hoja. Cabeceras: tolera mayúsculas/acentos ("Categoría" = "categoria") pero NO
 * columnas desconocidas (un "departamneto" mal escrito se ignoraría en silencio: error) ni cabeceras
 * obligatorias ausentes. Ignora filas totalmente vacías.
 */
export async function leerXlsx(
  buffer: Buffer,
  obligatorias: string[],
  opcionales: string[]
): Promise<{ ok: true; filas: FilaLeida[] } | { ok: false; error: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: 'El archivo no es un .xlsx válido.' };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: 'El archivo no tiene ninguna hoja.' };

  const cabeceras = new Map<number, string>();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const t = normalizarCabecera(celdaATexto(cell.value));
    if (t) cabeceras.set(col, t);
  });

  const permitidas = new Set([...obligatorias, ...opcionales]);
  const vistas = new Set<string>();
  for (const c of cabeceras.values()) {
    if (!permitidas.has(c)) return { ok: false, error: `Columna desconocida en la cabecera: «${c}». Columnas admitidas: ${[...permitidas].join(', ')}.` };
    if (vistas.has(c)) return { ok: false, error: `Columna duplicada en la cabecera: «${c}».` };
    vistas.add(c);
  }
  const faltan = obligatorias.filter((c) => !vistas.has(c));
  if (faltan.length) return { ok: false, error: `Faltan columnas obligatorias en la cabecera: ${faltan.join(', ')}.` };

  const filas: FilaLeida[] = [];
  for (let n = 2; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const valores: Record<string, string> = {};
    for (const [col, nombre] of cabeceras) valores[nombre] = celdaATexto(row.getCell(col).value);
    if (Object.values(valores).every((v) => v === '')) continue;
    filas.push({ fila: n, valores });
    if (filas.length > MAX_FILAS) return { ok: false, error: `El archivo supera el máximo de ${MAX_FILAS} filas por importación.` };
  }
  return { ok: true, filas };
}
