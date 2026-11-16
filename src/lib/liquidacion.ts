// src/lib/liquidacion.ts
// Reglas puras de «Liquidación» (banners del home por categoría). Sin React ni Supabase: se prueban con
// scripts/test-liquidacion.mjs. El precio es SIEMPRE el del producto (descuento_porcentaje entero): aquí solo se calcula.

export const DESCUENTO_MIN = 1;
export const DESCUENTO_MAX = 90;
/** Banners visibles por categoría (los más recientes). */
export const MAX_BANNERS_POR_CATEGORIA = 5;

export type EnvioTipo = "ninguno" | "gratis" | "descuento";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Misma fórmula que precioConOferta() de server/pagos.js y ofertaInfo() de lib/pricing.ts. */
export const precioConDescuento = (precio: number, pct: number) => r2(precio - (precio * pct) / 100);

/**
 * Descuento ENTERO (la columna del producto es entera) más cercano a un precio objetivo.
 * null si el precio no es válido (≤ 0, ≥ precio de lista) o el % queda fuera de 1–90.
 */
export function descuentoDesdePrecio(precioLista: number, precioObjetivo: number): number | null {
  if (!(precioLista > 0) || !(precioObjetivo > 0) || precioObjetivo >= precioLista) return null;
  const pct = Math.round((1 - precioObjetivo / precioLista) * 100);
  return pct >= DESCUENTO_MIN && pct <= DESCUENTO_MAX ? pct : null;
}

/** Columnas (de 6) que ocupa cada banner en PC, sin dejar huecos: 1→6 · 2→3+3 · 3→2+2+2 · 4→3×4 · 5→2+2+2+3+3. */
export function spansBanners(n: number): number[] {
  switch (Math.min(Math.max(Math.floor(n), 0), MAX_BANNERS_POR_CATEGORIA)) {
    case 1: return [6];
    case 2: return [3, 3];
    case 3: return [2, 2, 2];
    case 4: return [3, 3, 3, 3];
    case 5: return [2, 2, 2, 3, 3];
    default: return [];
  }
}

/** Agrupa por categoría y deja los `max` más recientes de cada una (created_at descendente). */
export function agruparPorCategoria<T extends { categoria: string; created_at: string }>(
  items: T[],
  max = MAX_BANNERS_POR_CATEGORIA,
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  const orden = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const it of orden) {
    const g = (out[it.categoria] ??= []);
    if (g.length < max) g.push(it);
  }
  return out;
}

/** Texto del sello de envío del banner; null si no lleva sello. */
export function selloEnvio(tipo: EnvioTipo, descuento?: number | null): { titulo: string; detalle: string } | null {
  if (tipo === "gratis") return { titulo: "DELIVERY GRATIS", detalle: "A TODA LIMA METROPOLITANA" };
  if (tipo === "descuento" && descuento && descuento > 0) {
    const monto = Number.isInteger(descuento) ? String(descuento) : descuento.toFixed(2);
    return { titulo: "DESCUENTO EN ENVÍO", detalle: `S/ ${monto} MENOS EN TU DELIVERY` };
  }
  return null;
}

/** «S/ 1,459» sin el prefijo: solo el número del precio, como en el banner de referencia. */
export function numeroBanner(n: number): string {
  const entero = Number.isInteger(n);
  const [e, d] = (entero ? String(n) : n.toFixed(2)).split(".");
  return `${e.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${d ? "." + d : ""}`;
}
