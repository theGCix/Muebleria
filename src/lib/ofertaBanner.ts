// src/lib/ofertaBanner.ts
// Datos de la tarjeta de oferta del home (banner con foto, sellos, regalo, nombre grande y precio). Funciones puras.
// Decisiones del dueño (2026-11-16): «Delivery gratis» activado en todas las ofertas (OJO: hoy el checkout cobra el
// envío según el distrito; el sello es solo visual) y regalo «juego de 3 cojines» en todas «por ahora».

/** Muestra el sello «Delivery gratis a todo Lima» en las tarjetas de oferta. Poner en false para quitarlo. */
export const ENVIO_GRATIS_OFERTAS = true;

/** Cojines del regalo (mismo para todas las ofertas por ahora; luego sería un dato por producto). */
export const REGALO_COJINES = 3;

export const textoRegalo = (n: number = REGALO_COJINES) => `JUEGO DE ${n} COJINES`;

/**
 * Parte el nombre en «rótulo» (arriba, chico) y «principal» (abajo, grande), como la referencia
 * («Juego de sala» / «LINEAL»):
 *  - «Mueble modelo lineal» → «Mueble» / «lineal»  (se corta en «modelo»)
 *  - «Dormitorio 2 plazas»  → «Dormitorio» / «2 plazas»  (sin «modelo»: la primera palabra es el rótulo)
 *  - «Sofá»                 → «» / «Sofá»
 */
export function partirNombre(nombre: string): { kicker: string; principal: string } {
  const limpio = nombre.replace(/\s+/g, " ").trim();
  const m = limpio.match(/^(.+?)\s+modelo\s+(.+)$/i);
  if (m) return { kicker: m[1], principal: m[2] };
  const i = limpio.indexOf(" ");
  if (i === -1) return { kicker: "", principal: limpio };
  return { kicker: limpio.slice(0, i), principal: limpio.slice(i + 1) };
}

/** «S/ 1,504» (sin decimales si es entero) o «S/ 1,504.50». */
export function fmtSolesBanner(n: number): string {
  const entero = Number.isInteger(n);
  const [e, d] = (entero ? String(n) : n.toFixed(2)).split(".");
  const miles = e.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `S/ ${miles}${d ? "." + d : ""}`;
}
