// src/hooks/useCatalogoHome.ts
// Trae de una sola vez las piezas activas para el catálogo del home.
// Los filtros (espacio, presupuesto, ofertas, orden) se aplican en el cliente,
// así cada interacción responde al instante, sin spinners ni nuevas consultas.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/hooks/useProducts";

export function useCatalogoHome(first = 60) {
  return useQuery({
    queryKey: ["products-catalogo-home", first],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: false })
        .limit(first);
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });
}