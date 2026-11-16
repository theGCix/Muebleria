// src/lib/limiteCompra.ts
// Tope de unidades por producto en cada compra. Fuente única del navegador (ficha, tarjeta, carrito,
// checkout y asistente pasan por cartStore). El servidor aplica el mismo número en `server/pagos.js`
// (CANTIDAD_MAX_POR_COMPRA): si lo cambias aquí, cámbialo allá (una prueba lo verifica).
// Las piezas que entran como parte de un combo no cuentan: el combo se vende como un conjunto.
// Para pedidos mayores el cliente cotiza por WhatsApp o con el asistente.

export const CANTIDAD_MAX_POR_COMPRA = 5;

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
  return Math.max(0, CANTIDAD_MAX_POR_COMPRA - unidadesDelProducto(items, id, exceptoLineId));
}
