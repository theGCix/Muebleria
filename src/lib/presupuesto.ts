// src/lib/presupuesto.ts
// Tramos de presupuesto de la tienda: UNA sola fuente para la portada, el catálogo del home
// y /catalogo. Son fijos (no se calculan en cada visita) y salen de los precios finales reales
// de los 17 productos activos (consulta del 2026-11-14, con ofertas vigentes aplicadas):
//   250 · 1000 · 1100 · 1485 · 1504 · 1700 · 1700 · 1800 · 1900 · 2100 · 2200 · 2250 ·
//   2280 · 2300 · 2300 · 2425 · 3200
// Reparto resultante: hasta 1,500 → 4 piezas · 1,500–2,000 → 5 · más de 2,000 → 8.
// Si el catálogo cambia mucho, se editan SOLO los números de TRAMOS.
//
// Regla de borde: `min` es exclusivo y `max` inclusivo (una pieza de S/ 1,500 exactos cae en
// «Hasta S/ 1,500», no en el tramo siguiente). Siempre se compara el precio FINAL
// (con la oferta vigente), igual que las tarjetas: `ofertaInfo(p).precioFinal`.
import { fmtPEN, ofertaInfo, type ProductoConOferta } from "@/lib/pricing";

export interface Rango {
  /** exclusivo; undefined = sin mínimo */
  min?: number;
  /** inclusivo; undefined = sin máximo */
  max?: number;
}

export interface Tramo extends Rango {
  id: string;
}

export const TRAMOS: readonly Tramo[] = [
  { id: "hasta-1500", max: 1500 },
  { id: "1500-2000", min: 1500, max: 2000 },
  { id: "mas-2000", min: 2000 },
];

/** Topes de los atajos «Hasta S/ X» del catálogo del home (los máximos de los tramos). */
export const ATAJOS_HASTA: readonly number[] = TRAMOS.flatMap((t) => (t.max != null ? [t.max] : []));

const monto = (n: number) => fmtPEN(n).replace(/\.00$/, "");

export function etiquetaRango({ min, max }: Rango): string {
  if (min != null && max != null) return `De ${monto(min)} a ${monto(max)}`;
  if (max != null) return `Hasta ${monto(max)}`;
  if (min != null) return `Más de ${monto(min)}`;
  return "Todos los precios";
}

export function precioEnRango(precio: number, { min, max }: Rango): boolean {
  return (min == null || precio > min) && (max == null || precio <= max);
}

export function mismoRango(a: Rango, b: Rango): boolean {
  return (a.min ?? null) === (b.min ?? null) && (a.max ?? null) === (b.max ?? null);
}

export const enRango = (p: ProductoConOferta, r: Rango) => precioEnRango(ofertaInfo(p).precioFinal, r);

/** Cuántas piezas caen en cada tramo (para mostrarlo en la portada). */
export function contarPorTramo(productos: ProductoConOferta[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TRAMOS) out[t.id] = productos.filter((p) => enRango(p, t)).length;
  return out;
}
