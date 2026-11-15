// src/lib/portada.ts
// Escena de la portada: elige qué pieza se muestra para cada tramo de presupuesto.
// Lógica pura (sin imports del proyecto) para poder probarla con `node scripts/test-portada.mjs`.
// No inventa nada: la pieza sale de los productos reales y de su precio final (con oferta vigente).

export interface CandidataEscena {
  /** Precio final (con la oferta vigente aplicada). */
  precioFinal: number;
  /** URL de la foto de la pieza; null/vacío = no se puede mostrar en la escena. */
  foto: string | null;
}

/**
 * Entre las piezas que caen en el tramo y tienen foto, devuelve la de mayor precio final:
 * «lo mejor que alcanza con este presupuesto». Si hay empate de precio, gana la primera de la
 * lista (el catálogo ya viene ordenado por más recientes). Sin candidatas devuelve null.
 */
export function elegirPiezaEscena<T extends CandidataEscena>(
  piezas: readonly T[],
  enTramo: (precioFinal: number) => boolean,
): T | null {
  let mejor: T | null = null;
  for (const p of piezas) {
    if (!p.foto || !Number.isFinite(p.precioFinal) || p.precioFinal <= 0) continue;
    if (!enTramo(p.precioFinal)) continue;
    if (!mejor || p.precioFinal > mejor.precioFinal) mejor = p;
  }
  return mejor;
}

/** Tramo que se muestra al abrir la página: el del medio (o el último si hay menos de dos). */
export function tramoInicial<T extends { id: string }>(tramos: readonly T[]): T | null {
  if (tramos.length === 0) return null;
  return tramos[Math.min(1, tramos.length - 1)];
}

export interface SlidePortada<T, R> {
  tramo: R;
  pieza: T;
}

/**
 * Carrusel del banner: una pieza por tramo de presupuesto (la mejor con foto, ver `elegirPiezaEscena`).
 * Un tramo sin pieza con foto no genera diapositiva (no se inventa nada). Respeta el orden de `tramos`.
 */
export function piezasPorTramo<T extends CandidataEscena, R extends { min: number | null; max: number | null }>(
  piezas: readonly T[],
  tramos: readonly R[],
  enTramo: (precioFinal: number, tramo: R) => boolean,
): SlidePortada<T, R>[] {
  const out: SlidePortada<T, R>[] = [];
  for (const tramo of tramos) {
    const pieza = elegirPiezaEscena(piezas, (n) => enTramo(n, tramo));
    if (pieza) out.push({ tramo, pieza });
  }
  return out;
}

/** Siguiente / anterior posición del carrusel, dando la vuelta en los extremos. Con 0 o 1 diapositivas siempre 0. */
export function moverIndice(actual: number, paso: 1 | -1, total: number): number {
  if (total <= 1) return 0;
  return (((actual + paso) % total) + total) % total;
}
