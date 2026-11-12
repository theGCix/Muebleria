// src/lib/buscarMenu.ts
// Filtro del menú lateral: ignora tildes y mayúsculas, busca por título de la opción y por nombre del grupo.
// Siempre se aplica sobre lo que el rol puede ver (canSee): una opción sin permiso nunca entra al resultado.
import { canSee, type NavGroup, type NavItem } from "@/components/nav-config";
import type { AppRole } from "@/hooks/useAuth";

/** Minúsculas y sin tildes: «cupon» encuentra «Cupones», «resena» encuentra «Reseñas». */
export const normalizarMenu = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type ResultadoMenu = {
  /** Grupos con al menos una coincidencia (sin grupos vacíos). */
  groups: NavGroup[];
  /** Primera opción coincidente, en el orden del menú (la que abre Enter). */
  primero: NavItem | null;
  /** Cantidad de opciones que coinciden. */
  total: number;
};

export function filtrarMenu(grupos: NavGroup[], roles: AppRole[], texto: string): ResultadoMenu {
  const q = normalizarMenu(texto);
  const permitidos = grupos
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i, roles)) }))
    .filter((g) => g.items.length > 0);

  if (!q) {
    const total = permitidos.reduce((n, g) => n + g.items.length, 0);
    return { groups: permitidos, primero: permitidos[0]?.items[0] ?? null, total };
  }

  const out: NavGroup[] = [];
  for (const g of permitidos) {
    const grupoCoincide = normalizarMenu(g.label).includes(q);
    const items = grupoCoincide ? g.items : g.items.filter((i) => normalizarMenu(i.title).includes(q));
    if (items.length > 0) out.push({ ...g, items });
  }
  return {
    groups: out,
    primero: out[0]?.items[0] ?? null,
    total: out.reduce((n, g) => n + g.items.length, 0),
  };
}

/**
 * Trozo del título que coincide con lo escrito, como [inicio, fin) sobre el texto ORIGINAL
 * (para resaltarlo aunque la búsqueda no lleve tildes). null si el título no contiene el texto.
 */
export function rangoCoincidencia(titulo: string, texto: string): [number, number] | null {
  const q = normalizarMenu(texto);
  if (!q) return null;
  let norm = "";
  const mapa: number[] = []; // posición en `norm` → posición en `titulo`
  for (let i = 0; i < titulo.length; i++) {
    const n = titulo[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (let k = 0; k < n.length; k++) {
      norm += n[k];
      mapa.push(i);
    }
  }
  const ini = norm.indexOf(q);
  if (ini < 0) return null;
  return [mapa[ini], mapa[ini + q.length - 1] + 1];
}
