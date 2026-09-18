import { claveTexto, definir, errorDeFila } from './nucleo';
import { formatoFecha, hoyMadrid, parseFecha } from './fechas';

interface FilaCoste {
  fila: number;
  perfil_id: string;
  coste_hora: number;
  desde: string;
}

/** Acepta `12.5` y `12,5` (el Excel en español guarda comas si la celda es texto). */
function parseImporte(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(/[€]/g, '');
  if (!/^\d+([.,]\d+)?$/.test(t)) return null;
  return Number(t.replace(',', '.'));
}

/**
 * Coste INTERNO por hora del empleado (control salarial), NO la tarifa de refacturación (`tarifa`, precio
 * facturable entre empresas). Versionado por fecha: cada fila AÑADE una versión con su `desde`; el histórico
 * nunca se machaca. La RLS de `coste_empleado` (solo admin_grupo) sigue actuando como segunda barrera.
 */
export const importadorCoste = definir<FilaCoste>({
  id: 'coste',
  ignoradas: ['nombre'],
  plantilla: {
    hoja: 'Coste por hora',
    columnas: [
      { cabecera: 'email', obligatoria: true, descripcion: 'Email del empleado (identificador único; nunca el nombre). Debe existir ya.', ejemplo: 'ana.ruiz@empresa.com' },
      { cabecera: 'coste_hora', obligatoria: true, descripcion: 'Coste interno de una hora de esa persona, en euros. Número mayor o igual que 0; coma o punto decimal.', ejemplo: '27,50' },
      {
        cabecera: 'desde',
        obligatoria: false,
        descripcion: 'Fecha desde la que rige este coste. Vacío = hoy.',
        admitidos: 'AAAA-MM-DD o DD/MM/AAAA',
        ejemplo: '2026-10-01',
        fecha: true,
      },
    ],
    notas: [
      'COSTE INTERNO, NO TARIFA: es lo que le cuesta la hora al grupo (control salarial). No confundir con las tarifas de refacturación, que son el precio facturable entre empresas.',
      'VERSIONADO: cada fila añade una versión nueva con su fecha «desde»; nunca se modifica el histórico. El coste vigente de una persona es el de mayor «desde» que no sea futura.',
      'Repetir una versión que ya existe (mismo email y misma fecha «desde») es un error de fila: para corregir un importe usa una fecha distinta.',
      'TODO O NADA: si el análisis detecta un solo error no se importa ninguna fila. El informe indica la fila y el motivo de cada error.',
      'El archivo exportado desde Usuarios → Coste/hora (columnas nombre, email, coste_hora, desde) sirve de punto de partida; la columna «nombre» se ignora.',
      'Es un dato salarial: solo el admin del grupo puede verlo, exportarlo e importarlo.',
    ],
  },

  async analizar({ supabase }, filas) {
    const hoy = hoyMadrid();
    const [perfiles, existentes] = await Promise.all([
      supabase.from('perfil').select('id, email'),
      supabase.from('coste_empleado').select('perfil_id, desde'),
    ]);
    const idPorEmail = new Map((perfiles.data ?? []).map((p) => [claveTexto(p.email), p.id as string]));
    const yaExiste = new Set((existentes.data ?? []).map((c) => `${c.perfil_id}|${c.desde}`));
    const enArchivo = new Map<string, number>();

    const validas: FilaCoste[] = [];
    const errores = [];

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

      let coste = 0;
      if (!v.coste_hora) motivos.push('falta coste_hora');
      else {
        const n = parseImporte(v.coste_hora);
        if (n === null) motivos.push(`coste_hora '${v.coste_hora}' no es un número válido (debe ser un importe mayor o igual que 0)`);
        else coste = n;
      }

      let desde = hoy;
      if (v.desde) {
        const f = parseFecha(v.desde);
        if (!f) motivos.push(`desde '${v.desde}' no es una fecha válida (usa AAAA-MM-DD o DD/MM/AAAA)`);
        else desde = f;
      }

      if (perfilId && !motivos.length) {
        const clave = `${perfilId}|${desde}`;
        if (yaExiste.has(clave)) motivos.push(`ya existe un coste de '${email}' con desde ${formatoFecha(desde)}: el histórico no se machaca (usa otra fecha)`);
        else if (enArchivo.has(clave)) motivos.push(`versión repetida en el archivo: '${email}' con desde ${formatoFecha(desde)} (también en la fila ${enArchivo.get(clave)})`);
        else enArchivo.set(clave, fila);
      }

      const error = errorDeFila(fila, motivos);
      if (error) errores.push(error);
      else validas.push({ fila, perfil_id: perfilId, coste_hora: coste, desde });
    }
    return { validas, errores };
  },

  /** Un solo INSERT masivo = una sola transacción: todo o nada por construcción. */
  async ejecutar({ supabase }, validas) {
    const { error } = await supabase.from('coste_empleado').insert(validas.map(({ perfil_id, coste_hora, desde }) => ({ perfil_id, coste_hora, desde })));
    return { error: error ? `No se pudo guardar el coste: ${error.message}. No se ha importado ninguna fila.` : null };
  },
});
