// src/hooks/useVolumenCarrito.ts
// Volumen embalado total (m³) del carrito, leído de products.volumen_m3.
// Si algún producto no tiene volumen cargado, `faltaVolumen` = true y el checkout
// ofrece "cotizar por WhatsApp" en vez de inventar un precio.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ItemCarrito {
  id: string;
  qty: number;
}

export function useVolumenCarrito(items: ItemCarrito[]) {
  const ids = [...new Set(items.map((i) => i.id))].sort();

  const { data, isLoading } = useQuery({
    queryKey: ["volumen-carrito", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, volumen_m3").in("id", ids);
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map((p: any) => [p.id as string, p.volumen_m3 as number | null]));
    },
  });

  let volumenTotal = 0;
  let faltaVolumen = ids.length > 0 && !data; // mientras carga, se considera "sin dato"
  if (data) {
    for (const it of items) {
      const v = data.get(it.id);
      if (v == null || Number(v) <= 0) faltaVolumen = true;
      else volumenTotal += Number(v) * it.qty;
    }
  }
  return { volumenTotal: Math.round(volumenTotal * 1000) / 1000, faltaVolumen, cargando: isLoading };
}