// src/lib/buscarDistrito.ts
// Búsqueda del selector de distrito (DistritoCombobox): sin tildes ni mayúsculas.

/** Minúsculas y sin tildes: «ancon» encuentra «Ancón». */
export const normalizarBusqueda = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Filtro de cmdk: 1 si el distrito empieza con lo escrito, 0.5 si lo contiene, 0 si no coincide. */
export function filtrarDistrito(valor: string, busqueda: string): number {
  const q = normalizarBusqueda(busqueda);
  if (!q) return 1;
  const v = normalizarBusqueda(valor);
  if (v.startsWith(q)) return 1;
  return v.includes(q) ? 0.5 : 0;
}
