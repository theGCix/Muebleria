// src/lib/armadorPresupuesto.ts
// Lógica pura del armador «Tu presupuesto manda» del home (deslizador + piezas que alcanzan).
// Sin imports del proyecto para probarla con `node scripts/test-armador-presupuesto.mjs`.
// No inventa nada: límites, conteo y «desde» salen de los precios finales reales (con la oferta vigente).

export const PASO = 100;

export interface Limites {
  min: number;
  max: number;
  paso: number;
}

/**
 * Rango del deslizador: del precio final más bajo al más alto, redondeado hacia arriba al paso. Así, en toda
 * posición del deslizador alcanza al menos la pieza más barata (nunca queda un tope sin piezas). Sin precios válidos devuelve null.
 */
export function limitesSlider(precios: readonly number[], paso = PASO): Limites | null {
  const validos = precios.filter((n) => Number.isFinite(n) && n > 0);
  if (validos.length === 0) return null;
  const min = Math.max(paso, Math.ceil(Math.min(...validos) / paso) * paso);
  const max = Math.max(min + paso, Math.ceil(Math.max(...validos) / paso) * paso);
  return { min, max, paso };
}

/** Valor con el que abre el deslizador: el preferido (p. ej. el tope del tramo del medio) dentro de los límites. */
export function valorInicial(l: Limites, preferido: number | null | undefined): number {
  const base = preferido != null && Number.isFinite(preferido) ? preferido : (l.min + l.max) / 2;
  const ajustado = Math.round(base / l.paso) * l.paso;
  return Math.min(l.max, Math.max(l.min, ajustado));
}

export interface PiezaPresupuesto {
  precioFinal: number;
  /** URL de la foto; null/vacío = no se puede mostrar. */
  foto: string | null;
}

export interface Alcance<T> {
  /** Cuántas piezas cuestan ≤ tope. */
  total: number;
  /** Precio final más bajo entre las que alcanzan; null si ninguna. */
  desde: number | null;
  /** Hasta `cuantas` piezas con foto, las de mayor precio que alcanzan («lo mejor que entra en tu presupuesto»). */
  vista: T[];
}

export function piezasQueAlcanzan<T extends PiezaPresupuesto>(
  piezas: readonly T[],
  tope: number,
  cuantas = 3,
): Alcance<T> {
  const entran = piezas.filter((p) => Number.isFinite(p.precioFinal) && p.precioFinal > 0 && p.precioFinal <= tope);
  const desde = entran.length ? Math.min(...entran.map((p) => p.precioFinal)) : null;
  const vista = entran
    .filter((p) => !!p.foto)
    .sort((a, b) => b.precioFinal - a.precioFinal)
    .slice(0, cuantas);
  return { total: entran.length, desde, vista };
}

export const textoPiezas = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

/** «Ver mis 5 opciones» / «Ver mi opción» / null si no hay ninguna. */
export function textoOpciones(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "Ver mi opción" : `Ver mis ${n} opciones`;
}
