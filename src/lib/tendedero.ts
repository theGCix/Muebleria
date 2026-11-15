// src/lib/tendedero.ts
// Lógica pura del tendedero de la portada (las piezas cuelgan de una cuerda con pinzas). Sin imports del proyecto
// para poder probarla con `node scripts/test-tendedero.mjs`.

export type Aspecto = "4/5" | "7/10" | "4/3";

/** Lugar de una pieza sobre la cuerda: `x` y `w` son fracciones (0-1) del ancho de la cuerda. */
export interface Hueco {
  x: number;
  w: number;
  aspecto: Aspecto;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Cuánto baja la cuerda (px) en la posición `t` (0 a 1): parábola, 0 en los extremos y `sag` en el centro. */
export function caida(t: number, sag: number): number {
  return Math.round(sag * 4 * t * (1 - t));
}

/** PC: una cuerda con hasta 3 piezas, bien separadas para que no se tapen al balancearse (≥ 11 % de aire). */
export function disposicionPC(n: number): Hueco[] {
  if (n >= 3)
    return [
      { x: 0.02, w: 0.24, aspecto: "4/5" },
      { x: 0.37, w: 0.26, aspecto: "7/10" },
      { x: 0.74, w: 0.24, aspecto: "4/5" },
    ];
  if (n === 2)
    return [
      { x: 0.12, w: 0.3, aspecto: "4/5" },
      { x: 0.56, w: 0.3, aspecto: "7/10" },
    ];
  if (n === 1) return [{ x: 0.36, w: 0.28, aspecto: "7/10" }];
  return [];
}

/** Móvil: dos cuerdas cortas, una pieza en cada una. */
export const DISPOSICION_MOVIL: readonly [Hueco, Hueco] = [
  { x: 0.1, w: 0.68, aspecto: "4/3" },
  { x: 0.14, w: 0.64, aspecto: "4/3" },
];

/**
 * Ángulo objetivo (°) de lo que cuelga según la inclinación del celular (`gamma` de deviceorientation).
 * Cuelga hacia el lado contrario a la inclinación. Solo en vertical (0° o 180°): en horizontal los ejes cambian.
 */
export function anguloInclinacion(gamma: number | null, pantalla: number, max = 18): number {
  if (gamma == null || !Number.isFinite(gamma)) return 0;
  const a = ((pantalla % 360) + 360) % 360;
  const base = a === 0 ? -gamma * 0.5 : a === 180 ? gamma * 0.5 : 0;
  return clamp(base, -max, max) + 0;
}

export interface ParamsPendulo {
  k: number; // rigidez del resorte
  c: number; // amortiguación
  s: number; // sensibilidad a la inclinación
  g: number; // ganancia de los empujones
  lim: number; // ángulo máximo (°)
  fase: number;
  w: number; // frecuencia del vaivén de reposo (rad/s)
}

/** PC: las tres piezas casi iguales (se mueven al unísono y no se cruzan). Móvil: cada una a su ritmo. */
export function paramsPendulo(i: number, pc: boolean): ParamsPendulo {
  return pc
    ? { k: 18 + (i % 3), c: 1.7, s: 1, g: 0.5, lim: 18, fase: i * 0.35, w: 0.8 }
    : { k: 15 + (i % 3) * 5, c: 1.5 + (i % 2) * 0.5, s: 0.85 + (i % 4) * 0.1, g: 1, lim: 40, fase: i * 1.7, w: 0.7 + (i % 3) * 0.12 };
}

export interface EstadoPendulo {
  a: number; // ángulo (°)
  v: number; // velocidad (°/s)
}

/** Un paso del péndulo (resorte amortiguado hacia el objetivo + vaivén de reposo). `tSeg` = tiempo en segundos. */
export function pasoPendulo(e: EstadoPendulo, p: ParamsPendulo, objetivo: number, tSeg: number, dt: number): void {
  const reposo = Math.sin(tSeg * p.w + p.fase) * 1.3;
  const meta = objetivo * p.s + reposo;
  e.v += (-p.k * (e.a - meta) - p.c * e.v) * dt;
  e.a = clamp(e.a + e.v * dt, -p.lim, p.lim);
}
