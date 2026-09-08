/**
 * Iconos SVG extraídos literalmente de los 4 mocks (empleado_web.html,
 * app_movil_empleado.html, panel_administracion.html, admin_movil.html).
 * Cero librerías externas -- cada path/circle/rect es una copia exacta del
 * markup del mock correspondiente, no una reinterpretación.
 */

export interface IconProps {
  className?: string;
  size?: number;
}

function base(size: number, strokeWidth: number, linejoin = true) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: linejoin ? ('round' as const) : undefined,
  };
}

/** Logo-mark / icono de reloj (usado como marca y en secciones de tiempo). */
export function IconReloj({ className, size = 17 }: IconProps) {
  return (
    <svg {...base(size, 2, false)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconChevronLeft({ className, size = 14 }: IconProps) {
  return (
    <svg {...base(size, 2)} className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight({ className, size = 14 }: IconProps) {
  return (
    <svg {...base(size, 2)} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Inicio (empleado): casa. */
export function IconCasa({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

export function IconCalendario({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

/** Tema claro/oscuro. */
export function IconTema({ className, size = 17 }: IconProps) {
  return (
    <svg {...base(size, 1.8, false)} className={className}>
      <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
    </svg>
  );
}

/** Historial / "Últimos días imputados", "Anteriores imputaciones". */
export function IconHistorial({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

/** "Hoy" (objetivo/ajuste radial). */
export function IconHoy({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8, false)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Ausencias: avión. */
export function IconAvion({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.6)} className={className}>
      <path d="M2 22h20" />
      <path d="M3.8 13.5 22 9l-1 3.8-8.6 2.3-4.6 4.4-2-.5 2.4-3.7-3.6-1.6-1.6 1.2-1.8-.5z" />
    </svg>
  );
}

/** Archivo / "Imputaciones anteriores". */
export function IconArchivo({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

/** FAB "+". */
export function IconMas({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 2.2, false)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Proyectos: carpeta. */
export function IconCarpeta({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

/** Inicio (admin): rejilla 2x2. */
export function IconRejilla({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

/** Usuarios: personas. */
export function IconUsuarios({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Empresas: edificio. */
export function IconEmpresa({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M3 21h18" />
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
    </svg>
  );
}

/** Categorías: etiqueta. */
export function IconCategoria({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M12 2H2v10l9.3 9.3a1.7 1.7 0 0 0 2.4 0l7.6-7.6a1.7 1.7 0 0 0 0-2.4Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

/** Control: portapapeles con check. */
export function IconControl({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

/** Tarifas: euro. */
export function IconTarifas({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8, false)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5a4.5 4.5 0 1 0 0 7" />
      <path d="M7.5 10.8h5M7.5 13.2h5" />
    </svg>
  );
}

/** Refacturaciones: libro de cuentas. */
export function IconRefacturacion({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

/** Ajustes: engranaje. */
export function IconAjustes({ className, size = 16 }: IconProps) {
  return (
    <svg {...base(size, 1.8)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

/** Drawer / menú hamburguesa. */
export function IconMenu({ className, size = 17 }: IconProps) {
  return (
    <svg {...base(size, 1.9, false)} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
