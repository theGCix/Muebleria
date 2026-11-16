// src/lib/liquidaciones.functions.ts
// Liquidación (panel admin): lectura de la tabla `liquidaciones` y escritura SOLO por las funciones SQL
// guardar_liquidacion / quitar_liquidacion (admin; aplican/retiran el descuento real del producto en una transacción).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";
import { DESCUENTO_MAX, DESCUENTO_MIN, type EnvioTipo } from "@/lib/liquidacion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<Db> {
  const { supabase } = await getAuthenticatedClient();
  return supabase as unknown as Db;
}

export interface ProductoLiquidable {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  descuento_porcentaje: number | null;
  oferta_vence_el: string | null;
}

export interface LiquidacionAdmin {
  id: string;
  categoria: string;
  product_id: string;
  imagen_url: string;
  kicker: string | null;
  nombre: string;
  detalle: string | null;
  descuento_aplicado: number;
  envio_tipo: EnvioTipo;
  envio_descuento: number | null;
  regalo_cojines: boolean;
  created_at: string;
  producto: ProductoLiquidable | null;
}

const opt = (max: number) => z.string().trim().max(max).nullable().optional();

const Schema = z
  .object({
    id: z.string().uuid().optional(),
    categoria: z.string().trim().min(1, "Elige una categoría"),
    product_id: z.string().uuid("Elige un producto"),
    imagen_url: z.string().regex(/^https:\/\//i, "Sube la imagen de fondo"),
    kicker: opt(40),
    nombre: z.string().trim().min(1, "Escribe el nombre del banner").max(40),
    detalle: opt(40),
    descuento: z.number().int().min(DESCUENTO_MIN, `Mínimo ${DESCUENTO_MIN} %`).max(DESCUENTO_MAX, `Máximo ${DESCUENTO_MAX} %`),
    envio_tipo: z.enum(["ninguno", "gratis", "descuento"]),
    envio_descuento: z.number().positive("Indica el descuento del envío en soles").max(1000).nullable().optional(),
    regalo_cojines: z.boolean(),
  })
  .refine((v) => v.envio_tipo !== "descuento" || !!v.envio_descuento, {
    message: "Indica cuántos soles se descuentan del envío",
    path: ["envio_descuento"],
  });
export type GuardarLiquidacionInput = z.input<typeof Schema>;

export async function listLiquidacionesAdmin(): Promise<LiquidacionAdmin[]> {
  const c = await db();
  const { data, error } = await c
    .from("liquidaciones")
    .select("*, products(id, nombre, precio, categoria, descuento_porcentaje, oferta_vence_el)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const { products, ...fila } = r as { products?: ProductoLiquidable | ProductoLiquidable[] | null } & Record<string, unknown>;
    const p = Array.isArray(products) ? products[0] : products;
    return { ...fila, producto: p ?? null } as unknown as LiquidacionAdmin;
  });
}

/** Productos de una categoría para elegir cuál se liquida. */
export async function listProductosLiquidables(categoria: string): Promise<ProductoLiquidable[]> {
  const c = await db();
  const { data, error } = await c
    .from("products")
    .select("id, nombre, precio, categoria, descuento_porcentaje, oferta_vence_el")
    .eq("categoria", categoria)
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductoLiquidable[];
}

export async function guardarLiquidacion(input: GuardarLiquidacionInput): Promise<string> {
  const v = Schema.parse(input);
  const c = await db();
  const { data, error } = await c.rpc("guardar_liquidacion", {
    _datos: { ...v, envio_descuento: v.envio_tipo === "descuento" ? v.envio_descuento : null },
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Devuelve true si también se retiró el descuento del producto. */
export async function quitarLiquidacion(id: string): Promise<boolean> {
  const c = await db();
  const { data, error } = await c.rpc("quitar_liquidacion", { _id: id });
  if (error) throw new Error(error.message);
  return !!data;
}
