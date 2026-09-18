import { claveTexto, definir, errorDeFila } from './nucleo';
import { diasEntre, formatoFecha, parseFecha } from './fechas';

const TIPOS = ['vacaciones', 'baja_medica', 'otro_permiso'] as const;
type Tipo = (typeof TIPOS)[number];
const ETIQUETA_TIPO: Record<Tipo, string> = { vacaciones: 'vacaciones', baja_medica: 'baja médica', otro_permiso: 'otro permiso' };
const MAX_DIAS = 366;

interface FilaAusencia {
  fila: number;
  perfil_id: string;
  tipo: Tipo;
  fecha_inicio: string;
  fecha_fin: string;
}

/** Solape inclusivo de dos rangos ISO. */
function solapa(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return aIni <= bFin && bIni <= aFin;
}

/**
 * Vacaciones (y bajas/permisos) del plan anual -> ausencias. Nacen `aprobada`, con el admin que importa
 * como aprobador: son HECHOS CONSUMADOS, no solicitudes. La mutación es el RPC `importar_ausencias`
 * (017): una transacción, mismo efecto aguas abajo que `aprobar_ausencia`.
 */
export const importadorVacaciones = definir<FilaAusencia>({
  id: 'vacaciones',
  plantilla: {
    hoja: 'Vacaciones',
    columnas: [
      { cabecera: 'email', obligatoria: true, descripcion: 'Email del empleado (identificador único; nunca el nombre). Debe existir ya.', ejemplo: 'leo.silva@empresa.com' },
      {
        cabecera: 'tipo',
        obligatoria: false,
        descripcion: 'Tipo de ausencia. Vacío = vacaciones.',
        admitidos: 'vacaciones · baja_medica · otro_permiso',
        ejemplo: 'vacaciones',
      },
      { cabecera: 'fecha_inicio', obligatoria: true, descripcion: 'Primer día de la ausencia (inclusive).', admitidos: 'AAAA-MM-DD o DD/MM/AAAA', ejemplo: '2026-12-21', fecha: true },
      { cabecera: 'fecha_fin', obligatoria: true, descripcion: 'Último día de la ausencia (inclusive). No puede ser anterior a fecha_inicio.', admitidos: 'AAAA-MM-DD o DD/MM/AAAA', ejemplo: '2026-12-31', fecha: true },
    ],
    notas: [
      'SON HECHOS CONSUMADOS, NO SOLICITUDES: cada fila nace con estado «aprobada» y el admin que importa figura como aprobador. Descuenta horas requeridas exactamente igual que una ausencia aprobada a mano, y bloquea la imputación esos días.',
      'Los borradores de imputación del empleado dentro de esas fechas se eliminan (igual que al aprobar una ausencia a mano).',
      'NUNCA DUPLICA NI PISA: si el empleado ya tiene una ausencia pendiente o aprobada que solape esas fechas, o dos filas del archivo se solapan entre sí, es un error de fila. Resolver solapes es manual.',
      'DÍAS CON HORAS YA REGISTRADAS DAN ERROR: si el empleado ya tiene horas computadas, aprobadas o cerradas dentro del rango, la fila falla — resuélvelo antes en la app.',
      'Rango máximo por fila: 366 días (protege de errores de año al teclear la fecha).',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error.',
    ],
  },

  async analizar({ supabase }, filas) {
    const perfiles = await supabase.from('perfil').select('id, email');
    const idPorEmail = new Map((perfiles.data ?? []).map((p) => [claveTexto(p.email), p.id as string]));

    const empleados = [...new Set(filas.map((f) => idPorEmail.get(claveTexto(f.valores.email ?? ''))).filter((x): x is string => !!x))];
    const [vivas, imputaciones] = await Promise.all([
      empleados.length
        ? supabase.from('ausencia').select('perfil_id, tipo, estado, fecha_inicio, fecha_fin').in('perfil_id', empleados).in('estado', ['pendiente', 'aprobada'])
        : Promise.resolve({ data: null }),
      empleados.length
        ? supabase.from('imputacion').select('empleado_id, fecha').in('empleado_id', empleados).in('estado', ['enviada', 'aprobada', 'cerrada'])
        : Promise.resolve({ data: null }),
    ]);

    const validasParciales: FilaAusencia[] = [];
    const errores = [];
    const aceptadas = new Map<string, { fila: number; ini: string; fin: string }[]>();

    for (const { fila, valores: v } of filas) {
      const motivos: string[] = [];
      const email = claveTexto(v.email ?? '');

      let perfilId = '';
      if (!email) motivos.push('falta el email');
      else {
        const id = idPorEmail.get(email);
        if (!id) motivos.push(`no existe ningún usuario con el email '${email}'`);
        else perfilId = id;
      }

      const tipoTexto = claveTexto(v.tipo ?? '') || 'vacaciones';
      const tipo = TIPOS.find((t) => t === tipoTexto);
      if (!tipo) motivos.push(`tipo '${v.tipo}' no válido (admitidos: ${TIPOS.join(', ')})`);

      let ini = '';
      let fin = '';
      if (!v.fecha_inicio) motivos.push('falta fecha_inicio');
      else ini = parseFecha(v.fecha_inicio) ?? '';
      if (v.fecha_inicio && !ini) motivos.push(`fecha_inicio '${v.fecha_inicio}' no es una fecha válida (usa AAAA-MM-DD o DD/MM/AAAA)`);
      if (!v.fecha_fin) motivos.push('falta fecha_fin');
      else fin = parseFecha(v.fecha_fin) ?? '';
      if (v.fecha_fin && !fin) motivos.push(`fecha_fin '${v.fecha_fin}' no es una fecha válida (usa AAAA-MM-DD o DD/MM/AAAA)`);

      if (ini && fin) {
        if (fin < ini) motivos.push(`fecha_fin (${formatoFecha(fin)}) es anterior a fecha_inicio (${formatoFecha(ini)})`);
        else if (diasEntre(ini, fin) + 1 > MAX_DIAS) motivos.push(`el rango ${formatoFecha(ini)}–${formatoFecha(fin)} supera ${MAX_DIAS} días (¿error de año?)`);
        else if (perfilId) {
          const choque = (vivas.data ?? []).find((a) => a.perfil_id === perfilId && solapa(ini, fin, a.fecha_inicio, a.fecha_fin));
          if (choque) {
            motivos.push(
              `solapa con una ausencia ${choque.estado === 'aprobada' ? 'aprobada' : 'pendiente'} existente de '${email}' (${ETIQUETA_TIPO[choque.tipo as Tipo] ?? choque.tipo}, ${formatoFecha(choque.fecha_inicio)}–${formatoFecha(choque.fecha_fin)}); resuélvelo a mano`
            );
          }
          const previa = (aceptadas.get(perfilId) ?? []).find((a) => solapa(ini, fin, a.ini, a.fin));
          if (previa) motivos.push(`solapa con la fila ${previa.fila} del propio archivo (${formatoFecha(previa.ini)}–${formatoFecha(previa.fin)}) del mismo empleado`);
          const dias = (imputaciones.data ?? []).filter((i) => i.empleado_id === perfilId && i.fecha >= ini && i.fecha <= fin).length;
          if (dias) motivos.push(`'${email}' ya tiene ${dias} imputación(es) computada(s), aprobada(s) o cerrada(s) dentro de ese rango`);
        }
      }

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else {
        validasParciales.push({ fila, perfil_id: perfilId, tipo: tipo!, fecha_inicio: ini, fecha_fin: fin });
        aceptadas.set(perfilId, [...(aceptadas.get(perfilId) ?? []), { fila, ini, fin }]);
      }
    }
    return { validas: validasParciales, errores };
  },

  async ejecutar({ supabase }, validas) {
    const { error } = await supabase.rpc('importar_ausencias', {
      p_filas: validas.map(({ perfil_id, tipo, fecha_inicio, fecha_fin }) => ({ perfil_id, tipo, fecha_inicio, fecha_fin })),
    });
    return { error: error ? `No se pudo importar: ${error.message}. No se ha importado ninguna fila.` : null };
  },
});
