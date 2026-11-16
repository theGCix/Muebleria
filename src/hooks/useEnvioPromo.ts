// src/hooks/useEnvioPromo.ts
// Liquidaciones VIGENTES con envío promocional para los productos del carrito (solo para mostrar el envío en el checkout;
// el servidor recalcula el cobro con la misma regla). Sin la tabla o sin red devuelve [] y el envío queda como siempre.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ofertaInfo } from "@/lib/pricing";
import type { LiquidacionEnvio } from "@/lib/envioPromo";

export function useEnvioPromo(items: { id: string; comboId?: string }[]) {
  const ids = [...new Set(items.filter((i) => !i.comboId).map((i) => i.id))].sort();
  return useQuery({
    queryKey: ["envio-promo", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<LiquidacionEnvio[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("liquidaciones")
        .select("product_id, envio_tipo, envio_descuento, products(precio, descuento_porcentaje, oferta_vence_el)")
        .in("product_id", ids)
        .neq("envio_tipo", "ninguno");
      if (error) return [];
      return (data ?? [])
        .filter((r: { products: unknown }) => {
          const p = (Array.isArray(r.products) ? r.products[0] : r.products) as
            | { precio: number; descuento_porcentaje: number | null; oferta_vence_el: string | null }
            | undefined;
          return !!p && ofertaInfo({ precio: Number(p.precio), descuento_porcentaje: p.descuento_porcentaje, oferta_vence_el: p.oferta_vence_el }).activa;
        })
        .map((r: LiquidacionEnvio) => ({ product_id: r.product_id, envio_tipo: r.envio_tipo, envio_descuento: r.envio_descuento }));
    },
  });
}
