// src/lib/limiteCompra.ts
// Tope de unidades por producto en cada compra. Fuente única del navegador (ficha, tarjeta, carrito,
// checkout y asistente pasan por cartStore). El servidor aplica el mismo número en `server/pagos.js`
// (CANTIDAD_MAX_POR_COMPRA): si lo cambias aquí, cámbialo allá (una prueba lo verifica).
// Las piezas que entran como parte de un combo no cuentan: el combo se vende como un conjunto.
// Para pedidos mayores a 99 el cliente cotiza por WhatsApp o con el asistente.

export const CANTIDAD_MAX_POR_COMPRA = 99;

/**
 * Decisión del dueño (2026-11-17): TODOS los productos se pueden pedir hasta {CANTIDAD_MAX_POR_COMPRA} unidades y también por
 * encima del stock (p. ej. 5 con 4 en stock): el checkout deja elegir entrega única (con más tiempo) o por partes.
 * Con stock 0 el producto sigue «Agotado» (eso no cambia). Antes: tope de 5, y 99 solo en el Juego de sala Lineal 3-2-1.
 * Las funciones conservan el parámetro `productId` por si algún día vuelve a haber excepciones por producto.
 */
export const permiteSobreStock = (_productId?: string): boolean => true;
/** Tope de unidades por compra de ese producto. */
export const maxPorCompra = (_productId?: string): number => CANTIDAD_MAX_POR_COMPRA;

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
