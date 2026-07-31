// src/lib/pricing.ts
// Utilidades de precio compartidas — ofertas y formato de moneda (PEN)

export const fmtPEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

/**
 * Precio final tras aplicar el descuento (si existe y es válido).
 * `descuento` es un porcentaje entero, ej. 20 = 20% off.
 */
export function precioFinal(precio: number, descuento?: number | null): number {
  if (!descuento || descuento <= 0) return precio;
  const final = precio - (precio * descuento) / 100;
  return Math.round(final * 100) / 100;
}

export function tieneOferta(descuento?: number | null): boolean {
  return typeof descuento === "number" && descuento > 0;
}

export function ahorro(precio: number, descuento?: number | null): number {
  return precio - precioFinal(precio, descuento);
}