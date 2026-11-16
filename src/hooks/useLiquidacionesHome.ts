// src/hooks/useLiquidacionesHome.ts
// Liquidaciones del home (tabla liquidaciones + precio real del producto). Solo cuentan las que tienen un descuento
// vigente en el producto: el precio sale de ofertaInfo (misma regla que el cobro), así el banner nunca queda desactualizado.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ofertaInfo } from "@/lib/pricing";
import type { EnvioTipo } from "@/lib/liquidacion";

export interface LiquidacionHome {
  id: string;
  product_id: string;
  categoria: string;
  created_at: string;
  imagen: string;
  kicker: string | null;
  nombre: string;
  detalle: string | null;
  envioTipo: EnvioTipo;
  envioDescuento: number | null;
  regaloCojines: boolean;
  precioRegular: number;
  precioFinal: number;
  descuento: number;
}

async function fetchLiquidaciones(): Promise<LiquidacionHome[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("liquidaciones")
    .select(
      "id, product_id, categoria, imagen_url, kicker, nombre, detalle, envio_tipo, envio_descuento, regalo_cojines, created_at, " +
        "products(precio, descuento_porcentaje, oferta_vence_el, activo)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return []; // sin la tabla o sin red: el home sigue sin esta sección
  const out: LiquidacionHome[] = [];
  for (const r of data ?? []) {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    if (!p || p.activo === false) continue;
    const info = ofertaInfo({ precio: Number(p.precio), descuento_porcentaje: p.descuento_porcentaje, oferta_vence_el: p.oferta_vence_el });
    if (!info.activa) continue;
    out.push({
      id: r.id,
      product_id: r.product_id,
      categoria: r.categoria,
      created_at: r.created_at,
      imagen: r.imagen_url,
      kicker: r.kicker,
      nombre: r.nombre,
      detalle: r.detalle,
      envioTipo: r.envio_tipo,
      envioDescuento: r.envio_descuento != null ? Number(r.envio_descuento) : null,
      regaloCojines: !!r.regalo_cojines,
      precioRegular: Number(p.precio),
      precioFinal: info.precioFinal,
      descuento: Math.round(Number(p.descuento_porcentaje)),
    });
  }
  return out;
}

export function useLiquidacionesHome() {
  return useQuery({ queryKey: ["liquidaciones-home"], queryFn: fetchLiquidaciones, staleTime: 60_000 });
}
