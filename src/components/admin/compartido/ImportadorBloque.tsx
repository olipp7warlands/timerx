'use client';

import { useRef, useState } from 'react';
import { analizarImportacion, ejecutarImportacion } from '@/app/admin/importadores';
import { useToast } from '@/components/empleado/compartido/Toast';
import type { InformeImportacion, TipoImportacion } from '@/lib/importadores/tipos';

interface Props {
  tipo: TipoImportacion;
  titulo: string;
  descripcion: string;
  /** Ruta del export (opcional: no todos los importadores tienen). */
  exportHref?: string;
  exportEtiqueta?: string;
  /** Se llama tras importar con éxito (recargar el listado de la sección). */
  onImportado?: () => void;
}

/**
 * UI única del patrón común de importadores: plantilla -> subir archivo -> ANÁLISIS EN SECO con informe ->
 * "Importar N filas" SOLO con cero errores (todo o nada). Toda la lógica vive en el servidor
 * (`src/app/admin/importadores.ts`); aquí solo se conserva el `File` analizado para enviarlo otra vez al importar.
 */
export function ImportadorBloque({ tipo, titulo, descripcion, exportHref, exportEtiqueta = 'Exportar', onImportado }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [informe, setInforme] = useState<InformeImportacion | null>(null);
  const [trabajando, setTrabajando] = useState<'analizando' | 'importando' | null>(null);

  function datos(): FormData {
    const fd = new FormData();
    fd.set('archivo', archivo!);
    return fd;
  }

  async function analizar() {
    if (!archivo) return;
    setTrabajando('analizando');
    setInforme(await analizarImportacion(tipo, datos()));
    setTrabajando(null);
  }

  async function importar() {
    if (!archivo) return;
    setTrabajando('importando');
    const resultado = await ejecutarImportacion(tipo, datos());
    setTrabajando(null);
    if (resultado.ok && resultado.importadas) {
      toast(`Importadas ${resultado.importadas} filas`);
      setArchivo(null);
      setInforme(null);
      if (inputRef.current) inputRef.current.value = '';
      onImportado?.();
    } else {
      setInforme(resultado);
    }
  }

  const sinErrores = informe?.ok && informe.errores.length === 0 && informe.validas > 0;

  return (
    <div>
      <h3 className="text-[13px] font-extrabold">{titulo}</h3>
      <p className="mt-0.5 text-xs text-ink-tertiary">{descripcion}</p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <a className="btn btn-sm" href={`/api/plantillas/${tipo}`} download>
          Descargar plantilla
        </a>
        {exportHref && (
          <a className="btn btn-sm" href={exportHref} download>
            {exportEtiqueta}
          </a>
        )}
      </div>

      <label className="mb-1 mt-3 block text-xs font-extrabold text-ink-tertiary">Archivo .xlsx</label>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="input"
        onChange={(e) => {
          setArchivo(e.target.files?.[0] ?? null);
          setInforme(null);
        }}
      />
      <button type="button" className="btn btn-sm mt-2.5" disabled={!archivo || trabajando !== null} onClick={analizar}>
        {trabajando === 'analizando' ? 'Analizando…' : 'Analizar archivo'}
      </button>

      {informe && !informe.ok && <p className="mt-3 text-xs font-bold text-ink-primary">✕ {informe.error}</p>}

      {informe?.ok && (
        <div className="mt-3">
          <p className="text-xs font-bold">
            {informe.totalFilas} filas leídas · {informe.validas} válidas · {informe.errores.length} con errores
          </p>
          {informe.errores.length > 0 && (
            <>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-subtle p-2.5 text-xs">
                {informe.errores.map((e) => (
                  <li key={e.fila}>
                    <span className="mono font-bold">fila {e.fila}:</span> {e.motivo}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-semibold text-ink-tertiary">
                No se importará nada mientras haya errores (todo o nada): corrige el archivo y vuelve a analizarlo.
              </p>
            </>
          )}
          {sinErrores && (
            <button type="button" className="btn btn-primary btn-sm mt-3" disabled={trabajando !== null} onClick={importar}>
              {trabajando === 'importando' ? 'Importando…' : `Importar ${informe.validas} filas`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
