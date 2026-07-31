// src/lib/pricing.ts
// Utilidades de precio compartidas — ofertas (con vencimiento) y formato de moneda (PEN)

export const fmtPEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

export interface ProductoConOferta {
  precio: number;
  descuento_porcentaje?: number | null;
  oferta_vence_el?: string | null;
}

export interface OfertaInfo {
  /** true si el descuento existe, es > 0, y (si tiene fecha) todavía no venció */
  activa: boolean;
  /** precio final a cobrar/mostrar */
  precioFinal: number;
  /** cuánto se ahorra respecto al precio original (0 si no hay oferta activa) */
  ahorro: number;
  /** Date de vencimiento si existe */
  venceEl: Date | null;
}

/**
 * Punto único de verdad: dado un producto, calcula si su oferta está
 * activa en este momento y el precio que corresponde mostrar/cobrar.
 * Úsalo en vez de leer descuento_porcentaje directamente en la UI.
 */
export function ofertaInfo(p: ProductoConOferta): OfertaInfo {
  const venceEl = p.oferta_vence_el ? new Date(p.oferta_vence_el) : null;
  const noVencida = !venceEl || venceEl.getTime() > Date.now();
  const activa = !!p.descuento_porcentaje && p.descuento_porcentaje > 0 && noVencida;

  const precioFinal = activa
    ? Math.round((p.precio - (p.precio * (p.descuento_porcentaje as number)) / 100) * 100) / 100
    : p.precio;

  return { activa, precioFinal, ahorro: p.precio - precioFinal, venceEl };
}

/**
 * Texto corto de cuenta regresiva para mostrar cerca del precio.
 * Devuelve null si no hay fecha de vencimiento o falta más de 14 días
 * (para no generar ruido visual en ofertas sin apuro).
 */
export function textoCuentaRegresiva(venceEl: Date | null): string | null {
  if (!venceEl) return null;
  const msRestante = venceEl.getTime() - Date.now();
  if (msRestante <= 0) return null;

  const dias = Math.ceil(msRestante / (1000 * 60 * 60 * 24));
  if (dias > 14) return null;
  if (dias <= 1) return "Termina hoy";
  return `Termina en ${dias} días`;
}