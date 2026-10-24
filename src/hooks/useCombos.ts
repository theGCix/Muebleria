// src/hooks/useCombos.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/hooks/useProducts";

export interface ComboItem {
  id: string;
  cantidad: number;
  product_id: string;
  products: Product;
}

export interface Combo {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_combo: number;
  imagen_url: string | null;
  imagen_public_id: string | null;
  activo: boolean;
  vence_el: string | null;
  created_at: string;
  combo_items: ComboItem[];
}

const SELECT_COMBO_CON_ITEMS = `*, combo_items(id, cantidad, product_id, products(*))`;

/**
 * Combos activos (y no vencidos) con sus productos incluidos, para
 * mostrar en la home / secciones de venta.
 */
export function useCombos(first = 8) {
  return useQuery({
    queryKey: ["combos-public", first],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("combos")
        .select(SELECT_COMBO_CON_ITEMS)
        .eq("activo", true)
        .or(`vence_el.is.null,vence_el.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(first);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Combo[];
    },
  });
}

export function useCombo(id: string) {
  return useQuery({
    queryKey: ["combo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select(SELECT_COMBO_CON_ITEMS)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as Combo;
    },
    enabled: !!id,
  });
}

/** Suma de precios individuales de los productos del combo (para el tachado). */
export function precioNormalCombo(combo: Combo): number {
  return combo.combo_items.reduce((s, it) => s + it.products.precio * it.cantidad, 0);
}

/**
 * Combo para el banner de la home: el que más ahorro real le da al cliente entre los que
 * tienen stock completo. Si ninguno ahorra algo, no hay destacado (no afirmamos ahorros falsos).
 */
export function comboDestacado(combos: Combo[]): Combo | null {
  const candidatos = combos
    .filter((c) => c.combo_items.length > 0)
    .filter((c) => c.combo_items.every((it) => (it.products.stock ?? 1) > 0))
    .map((c) => ({ c, ahorro: precioNormalCombo(c) - c.precio_combo }))
    .filter((x) => x.ahorro > 0)
    .sort((a, b) => b.ahorro - a.ahorro);
  return candidatos[0]?.c ?? null;
}

/** Cuántos combos completos se pueden armar con el stock actual (limitado por la pieza más escasa). */
export function combosDisponibles(combo: Combo): number | null {
  const n = combo.combo_items
    .filter((it) => it.products.stock != null)
    .map((it) => Math.floor((it.products.stock as number) / Math.max(1, it.cantidad)));
  return n.length ? Math.min(...n) : null;
}
