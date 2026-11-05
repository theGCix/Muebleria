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
