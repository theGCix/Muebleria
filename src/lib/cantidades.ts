// src/lib/cantidades.ts
// Formato de cantidades de insumos según su unidad. Solo visualización: no cambia lo que se guarda.
//  · unidades, planchas, piezas, paquetes, palos, bolsas → enteros
//  · metros, kg, litros, pies → máximo 1 decimal (sin «.0» sobrante)
//  · cualquier otra unidad (p. ej. una personalizada) → máximo 2 decimales, como antes

const ENTERAS = new Set(["unidades", "planchas", "piezas", "paquetes", "palos", "bolsas"]);
const UN_DECIMAL = new Set(["metros", "kg", "litros", "pies"]);

export function decimalesDeUnidad(unidad: string | null | undefined): 0 | 1 | 2 {
  const u = (unidad ?? "").trim().toLowerCase();
  if (ENTERAS.has(u)) return 0;
  if (UN_DECIMAL.has(u)) return 1;
  return 2;
}

/**
 * Número ya redondeado según la unidad, sin la unidad. «—» si no es un número.
 * Si un valor distinto de cero se redondea a 0, se muestra «< 0.1» (o «< 1») para no decir «0» cuando algo falta.
 */
export function formatoNumero(valor: unknown, unidad: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  const d = decimalesDeUnidad(unidad);
  const r = Number(n.toFixed(d));
  if (r === 0 && n !== 0) {
    const min = d === 0 ? "1" : d === 1 ? "0.1" : "0.01";
    return n > 0 ? `< ${min}` : `> -${min}`;
  }
  return String(r);
}

/** «12.5 metros», «3 planchas». */
export function formatoCantidad(valor: unknown, unidad: string | null | undefined): string {
  const num = formatoNumero(valor, unidad);
  return num === "—" ? num : `${num} ${unidad ?? ""}`.trim();
}

/** Faltante: «−12.5 metros»; si es menor que la precisión de la unidad, «< 0.1 metros». */
export function formatoFaltante(valor: unknown, unidad: string | null | undefined): string {
  const num = formatoNumero(valor, unidad);
  if (num === "—") return num;
  const u = unidad ?? "";
  return (num.startsWith("<") || num.startsWith(">") ? `${num} ${u}` : `−${num} ${u}`).trim();
}

/**
 * Para campos de cantidad: recorta lo que se escribe a los decimales que admite la unidad
 * (enteros → ninguno; metros, kg, litros, pies → 1). Otra unidad: sin cambios.
 * Conserva el signo y el punto a medio escribir («5.», «−», «»).
 */
export function limitarDecimales(texto: string, unidad: string | null | undefined): string {
  const d = decimalesDeUnidad(unidad);
  if (d >= 2) return texto;
  const t = texto.replace(",", ".");
  if (d === 0) return t.replace(/\..*$/, "");
  return t.replace(/^([^.]*\.\d?).*$/, "$1");
}

// ── Estado de stock de un insumo (pantalla Insumos → Stock) ───────────────────
//  · sin_stock    → stock ≤ 0                         (rojo)
//  · insuficiente → 0 < stock < stock mínimo           (rojo)  — misma regla que v_insumos_stock_bajo
//  · suficiente   → stock ≥ stock mínimo (mínimo > 0)  (verde)
//  · sin_minimo   → hay stock pero no hay mínimo       (gris)  — no se puede juzgar
export type EstadoStock = "sin_stock" | "insuficiente" | "suficiente" | "sin_minimo";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function estadoStock(stock: unknown, minimo: unknown): EstadoStock {
  const s = num(stock);
  const m = num(minimo);
  if (s <= 0) return "sin_stock";
  if (m <= 0) return "sin_minimo";
  return s < m ? "insuficiente" : "suficiente";
}

/** ¿Falta material? (rojo) */
export const faltaStock = (e: EstadoStock) => e === "sin_stock" || e === "insuficiente";

/**
 * Faltantes primero: «sin stock», luego «insuficiente» (de menor a mayor cobertura stock/mínimo),
 * y el resto por nombre. No modifica el arreglo original.
 */
export function ordenarPorUrgencia<T extends { nombre: string; stock_actual: unknown; stock_minimo: unknown }>(lista: T[]): T[] {
  const rango = (i: T) => {
    const e = estadoStock(i.stock_actual, i.stock_minimo);
    return e === "sin_stock" ? 0 : e === "insuficiente" ? 1 : 2;
  };
  const cobertura = (i: T) => num(i.stock_actual) / (num(i.stock_minimo) || 1);
  return [...lista].sort((a, b) => {
    const ra = rango(a), rb = rango(b);
    if (ra !== rb) return ra - rb;
    if (ra === 1) {
      const d = cobertura(a) - cobertura(b);
      if (d !== 0) return d;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });
}
