// src/lib/piezas.ts
// D7: piezas con medidas propias por producto (columna `products.piezas`, jsonb) y esquema (`products.esquema_url`).
// Formato esperado: [{ "nombre": "Sofá 3 plazas", "alto_cm": 85, "ancho_cm": 210, "fondo_cm": 95, "plazas": 3 }]
// Todo es opcional: lo que falta o es inválido se descarta (nunca se inventa un dato).

export interface Pieza {
  nombre: string;
  alto_cm: number | null;
  ancho_cm: number | null;
  fondo_cm: number | null;
  plazas: number | null;
}

/** Número positivo y finito; acepta "85", "85,5" o 85. Cualquier otra cosa → null. */
function positivo(v: unknown): number | null {
  let n = NaN;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && v.trim() !== "") n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Entero ≥ 1 o null. */
function plazasValidas(v: unknown): number | null {
  const n = positivo(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** Convierte el jsonb de la BD en piezas limpias. Descarta piezas sin nombre. */
export function normalizarPiezas(raw: unknown): Pieza[] {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: Pieza[] = [];
  for (const it of data) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const nombre = typeof o.nombre === "string" ? o.nombre.trim() : "";
    if (!nombre) continue;
    out.push({
      nombre,
      alto_cm: positivo(o.alto_cm),
      ancho_cm: positivo(o.ancho_cm),
      fondo_cm: positivo(o.fondo_cm),
      plazas: plazasValidas(o.plazas),
    });
  }
  return out;
}

/** ¿Alguna pieza trae al menos una medida o plazas? Si no, la ficha no muestra la sección. */
export function tieneMedidas(piezas: Pieza[]): boolean {
  return piezas.some((p) => p.alto_cm !== null || p.ancho_cm !== null || p.fondo_cm !== null || p.plazas !== null);
}

/** Solo URLs https (Cloudinary). Cualquier otra cosa → null. */
export function esquemaValido(url: unknown): string | null {
  return typeof url === "string" && /^https:\/\/\S+$/i.test(url.trim()) ? url.trim() : null;
}

/** Lee piezas y esquema de un producto sin depender del tipo `Product` (que aún no tiene estas columnas). */
export function piezasDeProducto(product: unknown): { piezas: Pieza[]; esquemaUrl: string | null } {
  const p = (product && typeof product === "object" ? product : {}) as Record<string, unknown>;
  return { piezas: normalizarPiezas(p.piezas), esquemaUrl: esquemaValido(p.esquema_url) };
}

/** 85 → "85 cm"; 85.5 → "85.5 cm". */
export function formatoCm(n: number | null): string {
  return n === null ? "—" : `${n.toLocaleString("es-PE", { maximumFractionDigits: 1 })} cm`;
}
