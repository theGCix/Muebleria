// src/hooks/useProductRatings.ts
// Calificaciones reales (reseñas aprobadas) para las tarjetas de producto.
// Una sola consulta a la vista v_producto_rating, compartida y cacheada por TODAS las tarjetas
// de la página: evita el patrón N+1 de pedir el rating producto por producto.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductoRating } from "@/lib/resenas.functions";

export interface RatingResumen {
  total: number;
  promedio: number;
}

type Fila = Pick<ProductoRating, "product_id" | "total_resenas" | "calificacion_promedio">;

export function useProductRatings() {
  return useQuery({
    queryKey: ["product-ratings-map"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_producto_rating")
        .select("product_id, total_resenas, calificacion_promedio");
      if (error) throw new Error(error.message);
      const mapa: Record<string, RatingResumen> = {};
      for (const r of (data ?? []) as Fila[]) {
        if (r.total_resenas > 0) {
          mapa[r.product_id] = { total: r.total_resenas, promedio: Number(r.calificacion_promedio) };
        }
      }
      return mapa;
    },
  });
}

/** Rating de un producto, o null si no tiene reseñas (la tarjeta simplemente no muestra estrellas). */
export function useProductRating(productId: string): RatingResumen | null {
  const { data } = useProductRatings();
  return data?.[productId] ?? null;
}