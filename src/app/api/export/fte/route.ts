import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { requeridasEfectivas, getJornadaHoras } from '@/lib/horas/requeridas-efectivas';

interface FilaFte {
  empleado: string;
  email: string;
  empresa_empleado: string;
  proyecto: string;
  empresa_proyecto: string;
  horas_proyecto: number;
  horas_imputadas_total: number;
  horas_requeridas: number;
  dias_vacaciones: number;
  dias_baja: number;
  dias_permiso: number;
}

const NOTA_FORMULAS =
  'FTE s/imputadas = Horas Proyecto / Horas Imputadas del empleado en el mes (reparto del trabajo real -- las filas de una persona suman 1,00). ' +
  'FTE s/requeridas = Horas Proyecto / Requeridas Efectivas del empleado (neto de ausencias -- las filas de una persona suman su ratio imputadas/requeridas, puede superar 1,00 si trabajó de más). ' +
  'Celda vacía cuando Requeridas Efectivas es 0 (mes entero de ausencia): no hay división por cero.';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const anio = Number(searchParams.get('anio'));
  const mes = Number(searchParams.get('mes'));
  const empresaId = searchParams.get('empresa') ?? '';
  if (!anio || !mes) {
    return NextResponse.json({ error: 'anio y mes son obligatorios' }, { status: 400 });
  }

  const supabase = await createClient();
  const [{ data, error }, jornadaHoras] = await Promise.all([
    supabase.rpc('fte_mes', { p_anio: anio, p_mes: mes }),
    getJornadaHoras(supabase),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filas: FilaFte[] = data ?? [];
  let nombreArchivo = `fte_grupo_${anio}-${String(mes).padStart(2, '0')}.xlsx`;
  let empresaNombre: string | null = null;

  if (empresaId) {
    const { data: empresa } = await supabase.from('empresa').select('nombre').eq('id', empresaId).single();
    empresaNombre = empresa?.nombre ?? null;
    if (empresaNombre) {
      filas = filas.filter((f) => f.empresa_empleado === empresaNombre);
      const slug = empresaNombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      nombreArchivo = `fte_${slug}_${anio}-${String(mes).padStart(2, '0')}.xlsx`;
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('FTE mensual');

  const ETIQUETAS: Record<string, string> = {
    empresa: 'Empresa',
    empleado: 'Empleado',
    horasImputadas: 'Horas Imputadas',
    horasRequeridas: 'Horas Requeridas',
    diasVacaciones: 'Vacaciones (días)',
    diasBaja: 'Bajas (días)',
    diasPermiso: 'Permisos (días)',
    proyecto: 'Proyecto',
    horasProyecto: 'Horas Proyecto',
    fteImputadas: 'FTE s/imputadas',
    fteRequeridas: 'FTE s/requeridas',
  };

  // Sin "header" en la definición de columnas: worksheet.columns rellena la fila 1
  // con los headers automáticamente si se declara ahí, y la fila 1 aquí es la nota
  // explicativa -- los headers reales van en la fila 2, añadidos a mano.
  const columnas = empresaId
    ? []
    : [{ key: 'empresa', width: 18 }];
  columnas.push(
    { key: 'empleado', width: 22 },
    { key: 'horasImputadas', width: 16 },
    { key: 'horasRequeridas', width: 16 },
    { key: 'diasVacaciones', width: 16 },
    { key: 'diasBaja', width: 14 },
    { key: 'diasPermiso', width: 15 },
    { key: 'proyecto', width: 22 },
    { key: 'horasProyecto', width: 15 },
    { key: 'fteImputadas', width: 15 },
    { key: 'fteRequeridas', width: 16 }
  );
  sheet.columns = columnas;

  sheet.mergeCells(1, 1, 1, columnas.length);
  const celdaNota = sheet.getCell(1, 1);
  celdaNota.value = NOTA_FORMULAS;
  celdaNota.alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(1).height = 45;

  const filaHeader = sheet.addRow(Object.fromEntries(columnas.map((c) => [c.key, ETIQUETAS[c.key]])));
  filaHeader.font = { bold: true };

  for (const f of filas) {
    const horasProyecto = Number(f.horas_proyecto);
    const horasImputadas = Number(f.horas_imputadas_total);
    const reqEfectivas = requeridasEfectivas({
      horasRequeridas: Number(f.horas_requeridas),
      diasVacaciones: f.dias_vacaciones,
      diasBaja: f.dias_baja,
      diasPermiso: f.dias_permiso,
      jornadaHoras,
    });

    sheet.addRow({
      empresa: f.empresa_empleado,
      empleado: f.empleado,
      horasImputadas,
      horasRequeridas: Number(f.horas_requeridas),
      diasVacaciones: f.dias_vacaciones,
      diasBaja: f.dias_baja,
      diasPermiso: f.dias_permiso,
      proyecto: f.proyecto,
      horasProyecto,
      fteImputadas: horasImputadas > 0 ? horasProyecto / horasImputadas : null,
      fteRequeridas: reqEfectivas > 0 ? horasProyecto / reqEfectivas : null,
    });
  }

  for (const key of ['horasImputadas', 'horasRequeridas', 'horasProyecto', 'fteImputadas', 'fteRequeridas']) {
    sheet.getColumn(key).numFmt = '0.00';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  });
}
