'use client';

import { useState } from 'react';
import type { EmpleadoCtx } from '../types';

/**
 * Lógica de "Computar día" compartida por las 4 superficies (Inicio y
 * Imputar, escritorio y móvil) -- cada una se queda con su propio shell de
 * confirmación (ModalCentrado en escritorio, BottomSheet en móvil).
 */
export function useComputarDia(ctx: EmpleadoCtx, fecha: string) {
  const [abierto, setAbierto] = useState(false);
  const [computando, setComputando] = useState(false);

  const pendientes = (ctx.porDia[fecha] ?? []).filter((l) => l.estado === 'borrador' || l.estado === 'rechazada');
  const horas = pendientes.reduce((s, l) => s + l.horas, 0);

  async function confirmar() {
    setComputando(true);
    const exito = await ctx.computarDia(fecha);
    setComputando(false);
    if (exito) setAbierto(false);
  }

  return { abierto, setAbierto, computando, confirmar, pendientes, horas };
}
