import type { ClaveColor } from '@/lib/horas/colores-departamento';

/**
 * Lista PREDEFINIDA de departamentos para el alta (uno, varios o todos) — v2.0. Cada uno trae un color de la paleta que no choca con los
 * demás; un departamento ya existente (mismo nombre, sin distinguir mayúsculas) se salta. «Nuevo» (personalizado) se da de alta aparte.
 */
export const PREDEFINIDOS: { nombre: string; color: ClaveColor }[] = [
  { nombre: 'Desarrollo', color: 'azul' },
  { nombre: 'Diseño', color: 'arena' },
  { nombre: 'Legal', color: 'malva' },
  { nombre: 'Administración y Finanzas', color: 'verde' },
  { nombre: 'Personas (RRHH)', color: 'rosa' },
  { nombre: 'Marketing y Comunicación', color: 'terracota' },
  { nombre: 'Comercial', color: 'ocre' },
  { nombre: 'Operaciones', color: 'turquesa' },
  { nombre: 'Deportivo', color: 'oliva' },
  { nombre: 'Dirección', color: 'pizarra' },
];
