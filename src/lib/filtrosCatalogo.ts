// src/lib/filtrosCatalogo.ts
// Filtros y orden de /catalogo: función pura, sin imports del proyecto, para poder probarla con
// `node scripts/test-filtros-catalogo.mjs`. El precio que se compara es el FINAL (con oferta
// vigente): quien llama lo calcula con `ofertaInfo` y lo pasa en `precioFinal`.
// Regla de borde (igual que lib/presupuesto.ts): `min` exclusivo, `max` inclusivo.

export type OrdenCatalogo = "recientes" | "precio_asc" | "precio_desc" | "descuento";

export const ORDENES_CATALOGO: readonly OrdenCatalogo[] = ["recientes", "precio_asc", "precio_desc", "descuento"];

export interface FiltrosCatalogo {
  q?: string;
  /** slug de categoría */
  cat?: string;
  /** slug de subcategoría («tipo»); solo tiene sentido junto con `cat` */
  sub?: string;
  min?: number;
  max?: number;
  /** solo piezas con oferta vigente */
  oferta?: boolean;
  sort?: OrdenCatalogo;
}

export interface ItemFiltrable {
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  subcategoria: string | null;
  precioFinal: number;
  enOferta: boolean;
  /** porcentaje de descuento vigente (0 si no hay oferta) */
  descuento: number;
  /** created_at (ISO) para «Más recientes» */
  creado: string;
}

/** Minúsculas, sin tildes ni signos: «Recámara» y «recamara» coinciden. */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const tiempo = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export function coincideBusqueda(it: ItemFiltrable, q?: string): boolean {
  const t = normalizar(q ?? "");
  if (!t) return true;
  const campos = [it.nombre, it.descripcion ?? "", it.categoria ?? "", it.subcategoria ?? ""].map(normalizar);
  // Todas las palabras deben aparecer (en cualquier campo): «sofa gris» encuentra «Sofá modular gris».
  return t.split(" ").every((w) => campos.some((c) => c.includes(w)));
}

/** Aplica los filtros SIN ordenar. `omitir` deja fuera un filtro (para contar opciones: «Salas · 3»). */
export function aplicarFiltros<T extends ItemFiltrable>(
  items: readonly T[],
  f: FiltrosCatalogo,
  omitir?: "cat" | "sub" | "precio" | "oferta",
): T[] {
  return items.filter((it) => {
    if (omitir !== "cat" && f.cat && it.categoria !== f.cat) return false;
    if (omitir !== "sub" && omitir !== "cat" && f.cat && f.sub && it.subcategoria !== f.sub) return false;
    if (omitir !== "precio") {
      if (f.min != null && !(it.precioFinal > f.min)) return false;
      if (f.max != null && !(it.precioFinal <= f.max)) return false;
    }
    if (omitir !== "oferta" && f.oferta && !it.enOferta) return false;
    return coincideBusqueda(it, f.q);
  });
}

export function ordenar<T extends ItemFiltrable>(items: readonly T[], sort: OrdenCatalogo = "recientes"): T[] {
  const reciente = (a: T, b: T) => tiempo(b.creado) - tiempo(a.creado);
  const l = [...items];
  if (sort === "precio_asc") return l.sort((a, b) => a.precioFinal - b.precioFinal || reciente(a, b));
  if (sort === "precio_desc") return l.sort((a, b) => b.precioFinal - a.precioFinal || reciente(a, b));
  if (sort === "descuento") {
    // Sin oferta vigente van al final (descuento 0), y a igual descuento gana la más reciente.
    return l.sort((a, b) => (b.enOferta ? b.descuento : 0) - (a.enOferta ? a.descuento : 0) || reciente(a, b));
  }
  return l.sort(reciente);
}

export function filtrarCatalogo<T extends ItemFiltrable>(items: readonly T[], f: FiltrosCatalogo): T[] {
  return ordenar(aplicarFiltros(items, f), f.sort);
}

/** Cuántos filtros hay activos (para «Filtros · n»). El orden y la búsqueda no cuentan: tienen su propio control. */
export function contarFiltros(f: FiltrosCatalogo): number {
  let n = 0;
  if (f.cat) n++;
  if (f.cat && f.sub) n++;
  if (f.min != null || f.max != null) n++;
  if (f.oferta) n++;
  return n;
}

/** Cuenta por valor de un campo, ignorando ese mismo filtro (así las demás opciones muestran su total real). */
export function contarPor<T extends ItemFiltrable>(
  items: readonly T[],
  f: FiltrosCatalogo,
  campo: "categoria" | "subcategoria",
): Record<string, number> {
  const base = aplicarFiltros(items, f, campo === "categoria" ? "cat" : "sub");
  const out: Record<string, number> = {};
  for (const it of base) {
    const v = it[campo];
    if (v) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}
