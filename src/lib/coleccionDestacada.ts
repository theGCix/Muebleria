// src/lib/coleccionDestacada.ts
// Lógica pura del carrusel 3D «Colección destacada» del home. Sin imports del proyecto para probarla con
// `node scripts/test-coleccion-destacada.mjs` (Node ≥ 22.18).

export interface PoseTarjeta {
  /** Desplazamiento horizontal en % del ancho de la tarjeta. */
  x: number;
  /** Giro en grados sobre el eje vertical (las laterales miran al centro). */
  rot: number;
  escala: number;
  opacidad: number;
  /** Oscurecimiento (0 a 1) de la foto: las laterales se atenúan con un velo, no con transparencia (se veían turbias). */
  velo: number;
  z: number;
}

/** Posición relativa de la tarjeta `i` respecto de la actual `cur` en un círculo de `n` (…, -1, 0, 1, …). */
export function offsetCircular(i: number, cur: number, n: number): number {
  if (n <= 0) return 0;
  let d = (((i - cur) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/** Actual al frente y grande; las dos vecinas giradas y atenuadas; el resto, ocultas a los lados. */
export function poseTarjeta(o: number): PoseTarjeta {
  const a = Math.abs(o);
  if (a === 0) return { x: 0, rot: 0, escala: 1.1, opacidad: 1, velo: 0, z: 3 };
  if (a === 1) return { x: o * 105, rot: -o * 28, escala: 0.88, opacidad: 1, velo: 0.45, z: 2 };
  return { x: o > 0 ? 190 : -190, rot: 0, escala: 0.8, opacidad: 0, velo: 0.45, z: 1 };
}

/** Avanza `d` posiciones (negativo = retrocede) dando la vuelta al llegar a los extremos. */
export function mover(cur: number, d: number, n: number): number {
  if (n <= 0) return 0;
  return (((cur + d) % n) + n) % n;
}

/**
 * Piezas automáticas mientras el dueño no publique las suyas en el panel «Carrusel del home».
 * Si hay suficientes, salta las primeras `saltar` (las que ya muestra «Directo del taller a tu hogar») para no repetir.
 */
export function elegirAutomaticas<T>(items: readonly T[], max = 5, saltar = 4): T[] {
  const m = Math.max(0, max);
  return items.length >= saltar + 4 ? items.slice(saltar, saltar + m) : items.slice(0, m);
}
