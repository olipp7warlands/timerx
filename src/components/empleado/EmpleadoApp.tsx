'use client';

import { useMemo, useState } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useDiasMes } from '@/hooks/useDiasMes';
import { useImputacionesMes, type ImputacionLinea, type NuevaLinea } from '@/hooks/useImputacionesMes';
import { useAusenciasMes } from '@/hooks/useAusenciasMes';
import { useProyectosAsignados } from '@/hooks/useProyectosAsignados';
import { useCategoriasTareas } from '@/hooks/useCategoriasTareas';
import { useBalanceMes } from '@/hooks/useBalanceMes';
import { useMaxHorasDia } from '@/hooks/useMaxHorasDia';
import { ausenciaEnFecha, fmt } from '@/lib/horas/calendario';
import { ToastProvider, useToast } from './compartido/Toast';
import { ShellMovil } from './movil/ShellMovil';
import { ShellEscritorio } from './escritorio/ShellEscritorio';
import type { EmpleadoCtx, Staged, StagedLinea, Tab } from './types';

interface Props {
  empresaId: string;
  empresaNombre: string;
  nombre: string;
  /** Solo para verificación visual (/debug/movil, /debug/escritorio): fuerza el layout sin depender del viewport real. */
  forzarLayout?: 'movil' | 'escritorio';
}

function EmpleadoAppInterno({ empresaId, empresaNombre, nombre, forzarLayout }: Props) {
  const isDesktopReal = useIsDesktop();
  const isDesktop = forzarLayout ? forzarLayout === 'escritorio' : isDesktopReal;
  const toast = useToast();

  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const fechaHoy = hoy.toISOString().slice(0, 10);

  const [tab, setTab] = useState<Tab>('inicio');
  const [selDay, setSelDay] = useState(fechaHoy);
  const [staged, setStaged] = useState<Staged | null>(null);

  const { dias, loading: diasLoading } = useDiasMes(anio, mes, empresaId);
  const { porDia, insertar, insertarLote, ajustarHoras, eliminar } = useImputacionesMes(anio, mes);
  const { ausencias, solicitar } = useAusenciasMes(anio, mes);
  const { paraFechas: proyectosParaFechas } = useProyectosAsignados();
  const { grupos } = useCategoriasTareas();
  const { balance } = useBalanceMes(anio, mes);
  const { maxHorasDia } = useMaxHorasDia();

  function reutilizarDia(origenFecha: string, aHoy: boolean) {
    const lineasOrigen = porDia[origenFecha] ?? [];
    const lineas: StagedLinea[] = lineasOrigen.map((l) => ({
      proyectoId: l.proyectoId,
      proyectoNombre: l.proyectoNombre,
      empresaNombre: l.empresaNombre,
      categoriaNombre: l.categoriaNombre,
      subcategoriaId: l.subcategoriaId,
      subcategoriaNombre: l.subcategoriaNombre,
      horas: l.horas,
    }));
    setStaged({ origen: origenFecha, lineas });
    if (aHoy) setSelDay(fechaHoy);
    setTab('imputar');
  }

  async function confirmarStaged() {
    if (!staged || staged.lineas.length === 0) return;

    const ausenciaDia = ausenciaEnFecha(selDay, ausencias);
    if (ausenciaDia?.estado === 'aprobada') {
      toast('No puedes imputar: tienes una ausencia aprobada este día.', 'error');
      return;
    }

    const disponibles = proyectosParaFechas([selDay]);
    const invalidas = staged.lineas.filter((l) => !disponibles.some((p) => p.id === l.proyectoId));
    if (invalidas.length > 0) {
      toast(`Ya no estás asignado a: ${invalidas.map((l) => l.proyectoNombre).join(', ')}`, 'error');
      return;
    }

    const lineas: NuevaLinea[] = staged.lineas.map((l) => ({
      proyectoId: l.proyectoId,
      subcategoriaId: l.subcategoriaId,
      horas: l.horas,
      fecha: selDay,
    }));
    const total = staged.lineas.reduce((s, l) => s + l.horas, 0);
    const { error } = await insertarLote(lineas);
    if (error) {
      toast(error, 'error');
      return;
    }
    toast(`Confirmado · ${fmt(total)} h en el día`);
    setStaged(null);
  }

  function descartarStaged() {
    setStaged(null);
  }

  function ajustarLineaStaged(index: number, horas: number) {
    setStaged((s) => (s ? { ...s, lineas: s.lineas.map((l, i) => (i === index ? { ...l, horas } : l)) } : s));
  }

  function anadirLineaStaged(linea: StagedLinea) {
    setStaged((s) => (s ? { ...s, lineas: [...s.lineas, linea] } : { origen: selDay, lineas: [linea] }));
  }

  async function usarLinea(linea: ImputacionLinea, destino: string) {
    const ausenciaDia = ausenciaEnFecha(destino, ausencias);
    if (ausenciaDia?.estado === 'aprobada') {
      toast('No puedes imputar: tienes una ausencia aprobada este día.', 'error');
      return;
    }
    if (!proyectosParaFechas([destino]).some((p) => p.id === linea.proyectoId)) {
      toast(`Ya no estás asignado a ${linea.proyectoNombre}`, 'error');
      return;
    }
    const { error } = await insertar({
      proyectoId: linea.proyectoId,
      subcategoriaId: linea.subcategoriaId,
      horas: linea.horas,
      fecha: destino,
    });
    if (error) toast(error, 'error');
    else toast(`Guardado · ${fmt(linea.horas)} h en ${linea.proyectoNombre}`);
  }

  async function guardarHoras(linea: NuevaLinea) {
    const { error } = await insertar(linea);
    if (error) {
      toast(error, 'error');
      return false;
    }
    toast(`Guardado · ${fmt(linea.horas)} h`);
    return true;
  }

  async function guardarHorasMultiDia(base: Omit<NuevaLinea, 'fecha'>, fechas: string[]) {
    const lineas = fechas.map((fecha) => ({ ...base, fecha }));
    const { error } = await insertarLote(lineas);
    if (error) {
      toast(error, 'error');
      return false;
    }
    toast(`Guardado · ${fmt(base.horas)} h${fechas.length > 1 ? ` × ${fechas.length} días` : ''}`);
    return true;
  }

  async function ajustarHorasLinea(id: string, horas: number) {
    const { error } = await ajustarHoras(id, horas);
    if (error) toast(error, 'error');
  }

  async function eliminarLinea(id: string) {
    const { error } = await eliminar(id);
    if (error) toast(error, 'error');
    else toast('Eliminada');
  }

  async function solicitarAusencia(tipo: 'vacaciones' | 'baja_medica' | 'otro_permiso', inicio: string, fin: string) {
    const { error } = await solicitar(tipo, inicio, fin);
    if (error) {
      toast(error, 'error');
      return false;
    }
    toast(`Solicitud enviada · ${tipo}`);
    return true;
  }

  if (isDesktop === null) {
    // Mismo markup en servidor y primer paint de cliente: sin mismatch de hidratación.
    return <div className="min-h-screen bg-bg" />;
  }

  const ctx: EmpleadoCtx = {
    anio,
    mes,
    fechaHoy,
    empresaId,
    empresaNombre,
    nombre,
    tab,
    setTab,
    selDay,
    setSelDay,
    staged,
    dias,
    diasLoading,
    porDia,
    ausencias,
    proyectosParaFechas,
    grupos,
    balance,
    maxHorasDia,
    reutilizarDia,
    confirmarStaged,
    descartarStaged,
    ajustarLineaStaged,
    anadirLineaStaged,
    usarLinea,
    guardarHoras,
    guardarHorasMultiDia,
    ajustarHorasLinea,
    eliminarLinea,
    solicitarAusencia,
  };

  return isDesktop ? <ShellEscritorio {...ctx} /> : <ShellMovil {...ctx} />;
}

export function EmpleadoApp(props: Props) {
  return (
    <ToastProvider>
      <EmpleadoAppInterno {...props} />
    </ToastProvider>
  );
}
