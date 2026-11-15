// src/lib/seccionesHome.ts
// Lógica pura de las secciones de la fase 3 del home (boceto v3): ofertas vigentes y pasos del taller.
// Sin imports del proyecto para probarla con `node scripts/test-secciones-home.mjs`.
// No inventa nada: las ofertas salen de los productos reales y los pasos del taller de lib/taller.ts (textos del dueño).

export interface OfertaMini {
  id: string;
  descuento: number;
  precioFinal: number;
}

/** Las N ofertas más fuertes: mayor descuento primero; con igual descuento, la más barata. */
export function topOfertas<T extends OfertaMini>(ofertas: readonly T[], n = 3): T[] {
  return [...ofertas]
    .filter((o) => o.descuento > 0)
    .sort((a, b) => b.descuento - a.descuento || a.precioFinal - b.precioFinal)
    .slice(0, Math.max(0, n));
}

export function textoPiezasConDescuento(n: number): string {
  return `${n} ${n === 1 ? "pieza" : "piezas"} con descuento`;
}

export interface PasoFuente {
  id: string;
  titulo: string;
  descripcion: string;
}

export interface PasoHome {
  n: number;
  /** Rótulo en negrita del boceto («Madera tornillo»). */
  titulo: string;
  /** Segunda línea del boceto («Selección»). */
  sub: string;
  /** Texto de apoyo accesible: sale de los pasos reales del taller. */
  descripcion: string;
}

// Los 4 pasos del boceto y de qué pasos reales de TALLER_PASOS salen. Si falta alguno de los pasos reales de un
// grupo, ese paso no se muestra (nunca se afirma algo que el taller no declare).
const GRUPOS: { ids: string[]; titulo: string; sub: string }[] = [
  { ids: ["corte"], titulo: "Madera tornillo", sub: "Selección" },
  { ids: ["lijado", "armado"], titulo: "Armado", sub: "y lijado" },
  { ids: ["acabado"], titulo: "Barniz", sub: "y acabado" },
  { ids: ["embalaje"], titulo: "Entrega", sub: "a tu casa" },
];

export function pasosTallerHome(fuente: readonly PasoFuente[]): PasoHome[] {
  const porId = new Map(fuente.map((p) => [p.id, p]));
  const pasos: Omit<PasoHome, "n">[] = [];
  for (const g of GRUPOS) {
    const reales = g.ids.map((id) => porId.get(id));
    if (reales.some((r) => !r)) continue;
    pasos.push({
      titulo: g.titulo,
      sub: g.sub,
      descripcion: reales.map((r) => `${r!.titulo}: ${r!.descripcion}`).join(" "),
    });
  }
  return pasos.map((p, i) => ({ ...p, n: i + 1 }));
}
