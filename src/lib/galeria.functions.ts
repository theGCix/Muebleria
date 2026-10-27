// src/lib/galeria.functions.ts
// Testimonios con fotos cargados a mano desde el panel (tabla galeria_clientes).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// La tabla aún no está en types.ts (se regenera con el CLI de Supabase).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<Db> {
  const { supabase } = await getAuthenticatedClient();
  return supabase as unknown as Db;
}

export interface GaleriaItem {
  id: string;
  autor_nombre: string;
  fotos: string[];
  comentario: string | null;
  calificacion: number | null;
  product_id: string | null;
  producto_nombre: string | null;
  publicado: boolean;
  created_at: string;
}

const GuardarSchema = z.object({
  id: z.string().uuid().optional(),
  autor_nombre: z.string().trim().min(2, "Escribe el nombre del cliente").max(80),
  fotos: z.array(z.string().regex(/^https:\/\//i)).min(1, "Sube al menos una foto").max(6),
  comentario: z.string().trim().max(600).nullable().optional(),
  calificacion: z.number().int().min(1).max(5).nullable().optional(),
  product_id: z.string().nullable().optional(),
  producto_nombre: z.string().trim().max(120).nullable().optional(),
  publicado: z.boolean(),
});
export type GuardarGaleriaInput = z.input<typeof GuardarSchema>;

export async function listGaleriaAdmin(): Promise<GaleriaItem[]> {
  const c = await db();
  const { data, error } = await c.from("galeria_clientes").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as GaleriaItem[];
}

export async function guardarGaleria(input: GuardarGaleriaInput) {
  const v = GuardarSchema.parse(input);
  const c = await db();
  const fila = {
    autor_nombre: v.autor_nombre,
    fotos: v.fotos,
    comentario: v.comentario || null,
    calificacion: v.calificacion ?? null,
    product_id: v.product_id || null,
    producto_nombre: v.producto_nombre || null,
    publicado: v.publicado,
  };
  const { error } = v.id
    ? await c.from("galeria_clientes").update(fila).eq("id", v.id)
    : await c.from("galeria_clientes").insert(fila);
  if (error) throw new Error(error.message);
}

export async function setPublicadoGaleria(id: string, publicado: boolean) {
  const c = await db();
  const { error } = await c.from("galeria_clientes").update({ publicado }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarGaleria(id: string) {
  const c = await db();
  const { error } = await c.from("galeria_clientes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listProductosBasico(): Promise<{ id: string; nombre: string }[]> {
  const c = await db();
  const { data, error } = await c.from("products").select("id, nombre").order("nombre").limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string | number; nombre: string }[]).map((p) => ({ id: String(p.id), nombre: p.nombre }));
}