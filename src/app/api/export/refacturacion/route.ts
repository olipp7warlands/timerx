import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const anio = Number(searchParams.get('anio'));
  const mes = Number(searchParams.get('mes'));
  if (!anio || !mes) {
    return NextResponse.json({ error: 'anio y mes son obligatorios' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_refacturacion_mensual')
    .select('empresa_origen, empresa_destino, categoria, horas, importe')
    .eq('anio', anio)
    .eq('mes', mes);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Refacturación');
  sheet.columns = [
    { header: 'Origen', key: 'origen', width: 24 },
    { header: 'Destino', key: 'destino', width: 24 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Horas', key: 'horas', width: 12 },
    { header: '€/h', key: 'eurosHora', width: 10 },
    { header: 'Importe', key: 'importe', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  let totalHoras = 0;
  let totalImporte = 0;
  for (const fila of data ?? []) {
    const horas = Number(fila.horas);
    const importe = Number(fila.importe);
    totalHoras += horas;
    totalImporte += importe;
    sheet.addRow({
      origen: fila.empresa_origen,
      destino: fila.empresa_destino,
      categoria: fila.categoria,
      horas,
      eurosHora: horas > 0 ? importe / horas : 0,
      importe,
    });
  }

  const filaTotal = sheet.addRow({ origen: 'Total', horas: totalHoras, importe: totalImporte });
  filaTotal.font = { bold: true };

  sheet.getColumn('horas').numFmt = '0.00';
  sheet.getColumn('eurosHora').numFmt = '0.00';
  sheet.getColumn('importe').numFmt = '0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="refacturacion_${anio}-${String(mes).padStart(2, '0')}.xlsx"`,
    },
  });
}
