import type { DiaMes } from '@/lib/horas/calendario';
import type { ImputacionLinea, NuevaLinea } from '@/hooks/useImputacionesMes';
import type { Ausencia } from '@/hooks/useAusenciasMes';
import type { ProyectoAsignado } from '@/hooks/useProyectosAsignados';
import type { GrupoTareas } from '@/hooks/useCategoriasTareas';
import type { BalanceMes } from '@/hooks/useBalanceMes';

/** Línea precargada (staged), forma equivalente a la de los mocks {proyecto,empresa,cat,sub,horas} pero con IDs reales. */
export interface StagedLinea {
  proyectoId: string;
  proyectoNombre: string;
  empresaNombre: string;
  categoriaNombre: string;
  subcategoriaId: string;
  subcategoriaNombre: string;
  horas: number;
}

export interface Staged {
  origen: string; // fecha ISO de origen
  lineas: StagedLinea[];
}

export type Tab = 'inicio' | 'imputar' | 'calendario';

/** Datos y acciones que ambos shells (móvil/escritorio) consumen — misma capa, distinta disposición. */
export interface EmpleadoCtx {
  anio: number;
  mes: number;
  fechaHoy: string;
  empresaId: string;
  empresaNombre: string;
  nombre: string;

  tab: Tab;
  setTab: (t: Tab) => void;
  selDay: string;
  setSelDay: (f: string) => void;
  staged: Staged | null;

  dias: DiaMes[];
  diasLoading: boolean;
  porDia: Record<string, ImputacionLinea[]>;
  ausencias: Ausencia[];
  proyectosParaFechas: (fechas: string[]) => ProyectoAsignado[];
  grupos: GrupoTareas[];
  balance: BalanceMes | null;
  maxHorasDia: number | null;

  reutilizarDia: (origenFecha: string, aHoy: boolean) => void;
  confirmarStaged: () => Promise<void>;
  descartarStaged: () => void;
  ajustarLineaStaged: (index: number, horas: number) => void;
  anadirLineaStaged: (linea: StagedLinea) => void;
  usarLinea: (linea: ImputacionLinea, destino: string) => Promise<void>;
  /** true = éxito. Los consumidores (wizard) deben mantener la hoja abierta si devuelve false, para no perder la selección tras un error. */
  guardarHoras: (linea: NuevaLinea) => Promise<boolean>;
  guardarHorasMultiDia: (base: Omit<NuevaLinea, 'fecha'>, fechas: string[]) => Promise<boolean>;
  ajustarHorasLinea: (id: string, horas: number) => Promise<void>;
  eliminarLinea: (id: string) => Promise<void>;
  solicitarAusencia: (tipo: 'vacaciones' | 'baja_medica' | 'otro_permiso', inicio: string, fin: string) => Promise<boolean>;
  /** true = éxito (o nada que enviar). false si el RPC dio error -- el modal de confirmación debe quedarse abierto. */
  enviarPendientes: () => Promise<boolean>;
}
