// src/lib/colorNames.ts
// Colores base de mueblería + utilidades para ponerle nombre a un color elegido de una foto.

export const COLORES_BASE = [
  { name: "Blanco", hex: "#f5f3ee" },
  { name: "Crema", hex: "#e8dfc9" },
  { name: "Beige", hex: "#d8c8a8" },
  { name: "Arena", hex: "#c9b08a" },
  { name: "Gris claro", hex: "#c9cbcd" },
  { name: "Gris", hex: "#8e9196" },
  { name: "Gris oscuro", hex: "#4b4e52" },
  { name: "Negro", hex: "#1e1e1f" },
  { name: "Camel", hex: "#b58655" },
  { name: "Marrón", hex: "#6b4c38" },
  { name: "Chocolate", hex: "#3b2b1f" },
  { name: "Mostaza", hex: "#c9a227" },
  { name: "Terracota", hex: "#b5654a" },
  { name: "Rosado", hex: "#e6bdb4" },
  { name: "Rojo", hex: "#a32a2a" },
  { name: "Vino", hex: "#5e1f2b" },
  { name: "Verde oliva", hex: "#6f7648" },
  { name: "Verde", hex: "#3f6b4f" },
  { name: "Celeste", hex: "#9db7d1" },
  { name: "Azul", hex: "#3e5c8a" },
  { name: "Azul marino", hex: "#1f2e4d" },
  { name: "Morado", hex: "#6c4a8a" },
] as const;

/** "#abc" | "abc" | "#aabbcc" → "#aabbcc" (minúsculas), o null si no es válido. */
export function normalizarHex(v: string): string | null {
  const m = v.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(m)) return `#${m.split("").map((c) => c + c).join("")}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(m)) return `#${m}`.toLowerCase();
  return null;
}

const rgb = (hex: string): [number, number, number] => {
  const h = normalizarHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

/** Nombre del color base más parecido (distancia "redmean", suficiente para nombrar tapizados). */
export function nombreMasCercano(hex: string): string {
  const [r1, g1, b1] = rgb(hex);
  let mejor: string = COLORES_BASE[0].name;
  let dMin = Infinity;
  for (const c of COLORES_BASE) {
    const [r2, g2, b2] = rgb(c.hex);
    const rm = (r1 + r2) / 2;
    const d = (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2;
    if (d < dMin) {
      dMin = d;
      mejor = c.name;
    }
  }
  return mejor;
}