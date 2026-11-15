// src/lib/portadaCarrusel.ts
// Lógica pura de la portada v3 (carrusel de 4 diapositivas). Sin imports del proyecto para poder probarla con
// `node scripts/test-portada-carrusel.mjs`. No inventa nada: todo sale de la campaña y de los precios reales.

export type DiapositivaId = "locura" | "salas" | "medida" | "pruebalo";

export const DIAPOSITIVAS: readonly DiapositivaId[] = ["locura", "salas", "medida", "pruebalo"];

/** Sin campaña vigente no hay diapositiva ni pestaña de «Días de locura»; quedan las otras tres. */
export function diapositivasActivas(hayCampana: boolean): DiapositivaId[] {
  return DIAPOSITIVAS.filter((d) => d !== "locura" || hayCampana);
}

const DIA_MS = 86_400_000;

/** Días que faltan (redondeo hacia arriba); null si no hay fecha o ya venció. */
export function diasRestantes(venceMs: number | null, ahoraMs: number): number | null {
  if (venceMs == null) return null;
  const ms = venceMs - ahoraMs;
  if (ms <= 0) return null;
  return Math.ceil(ms / DIA_MS);
}

/** «TERMINA EN 13 DÍAS» / «TERMINA HOY» (la etiqueta del boceto va en mayúsculas). */
export function textoTermina(dias: number | null): string | null {
  if (dias == null) return null;
  if (dias <= 1) return "TERMINA HOY";
  return `TERMINA EN ${dias} DÍAS`;
}

/** Menor precio de una lista (ignora valores no válidos); null si no hay ninguno. */
export function precioMinimo(precios: readonly number[]): number | null {
  let min: number | null = null;
  for (const n of precios) {
    if (!Number.isFinite(n) || n <= 0) continue;
    if (min == null || n < min) min = n;
  }
  return min;
}

/** Monto sin decimales cuando es entero: 1504 → «S/ 1,504»; 1504.5 → «S/ 1,504.50». */
export function montoCorto(n: number): string {
  const entero = Number.isInteger(n);
  const txt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `S/ ${txt}`;
}

/** Siguiente / anterior posición dando la vuelta en los extremos. Con 0 o 1 elementos siempre 0. */
export function siguiente(actual: number, paso: 1 | -1, total: number): number {
  if (total <= 1) return 0;
  return (((actual + paso) % total) + total) % total;
}
