// src/lib/limiteCompra.ts
// Tope de unidades por producto en cada compra. Fuente única del navegador (ficha, tarjeta, carrito,
// checkout y asistente pasan por cartStore). El servidor aplica el mismo número en `server/pagos.js`
// (CANTIDAD_MAX_POR_COMPRA): si lo cambias aquí, cámbialo allá (una prueba lo verifica).
// Las piezas que entran como parte de un combo no cuentan: el combo se vende como un conjunto.
// Para pedidos mayores el cliente cotiza por WhatsApp o con el asistente.

export const CANTIDAD_MAX_POR_COMPRA = 5;

/**
 * Productos con tope ampliado (decisión del dueño, 2026-11-16): se pueden pedir hasta {CANTIDAD_MAX_AMPLIA} unidades y también
 * por encima del stock (p. ej. 5 con 4 en stock): el checkout ya deja elegir entrega única (con más tiempo) o por partes.
 * Mismos valores en `server/pagos.js` (una prueba lo verifica). Hoy: Juego de sala Lineal 3-2-1.
 */
export const CANTIDAD_MAX_AMPLIA = 99;
export const PRODUCTOS_TOPE_AMPLIO: readonly string[] = ["0fad1859-f6e3-4e7f-a598-f14bb7143dcd"];
export const permiteSobreStock = (productId: string): boolean => PRODUCTOS_TOPE_AMPLIO.includes(productId);
/** Tope de unidades por compra de ese producto. */
export const maxPorCompra = (productId: string): number => (permiteSobreStock(productId) ? CANTIDAD_MAX_AMPLIA : CANTIDAD_MAX_POR_COMPRA);

export interface LineaLimite {
  id: string;
  qty: number;
  lineId?: string;
  comboId?: string;
}

/** Unidades sueltas (sin combo) de un producto en el carrito, sin contar la línea `exceptoLineId`. */
export function unidadesDelProducto(items: LineaLimite[], id: string, exceptoLineId?: string): number {
  return items
    .filter((i) => i.id === id && !i.comboId && (exceptoLineId === undefined || i.lineId !== exceptoLineId))
    .reduce((s, i) => s + i.qty, 0);
}

/** Cuántas unidades más se pueden agregar de ese producto (nunca negativo). */
export function cupoRestante(items: LineaLimite[], id: string, exceptoLineId?: string): number {
  return Math.max(0, maxPorCompra(id) - unidadesDelProducto(items, id, exceptoLineId));
}
