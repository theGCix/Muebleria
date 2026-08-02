// src/lib/resenas.functions.ts
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// ── Tipos ──────────────────────────────────────────────────
export interface ResenaPublica {
  id: string;
  product_id: string;
  calificacion: number;
  titulo: string | null;
  comentario: string | null;
  fotos: string[];
  votos_utiles: number;
  respuesta_tienda: string | null;
  respuesta_tienda_at: string | null;
  created_at: string;
  autor_nombre: string;
}

export interface ProductoRating {
  product_id: string;
  total_resenas: number;
  calificacion_promedio: number;
  cinco_estrellas: number;
  cuatro_estrellas: number;
  tres_estrellas: number;
  dos_estrellas: number;
  una_estrella: number;
  resenas_con_fotos: number;
}

export type ResenaEstado = "pendiente" | "aprobada" | "rechazada";

export interface ResenaAdmin {
  id: string;
  product_id: string;
  customer_id: string | null;
  order_id: string | null;
  calificacion: number;
  titulo: string | null;
  comentario: string | null;
  fotos: string[];
  aprobada: boolean;
  motivo_rechazo: string | null;
  moderada_por: string | null;
  moderada_at: string | null;
  respuesta_tienda: string | null;
  respuesta_tienda_at: string | null;
  votos_utiles: number;
  created_at: string;
  products: { nombre: string; imagen_url: string | null } | null;
  customers: { nombre: string; email: string | null } | null;
}

export function resenaEstado(r: { aprobada: boolean; motivo_rechazo: string | null }): ResenaEstado {
  if (r.aprobada) return "aprobada";
  if (r.motivo_rechazo) return "rechazada";
  return "pendiente";
}

// ── Público: mostrar en la ficha de producto (sin login) ────
export async function fetchProductReviews(productId: string) {
  const { data, error } = await supabase
    .from("v_resenas_publicas")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { resenas: (data ?? []) as ResenaPublica[] };
}

export async function fetchProductRating(productId: string) {
  const { data, error } = await supabase
    .from("v_producto_rating")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { rating: data as ProductoRating | null };
}

// ── Staff: cola de moderación ────────────────────────────────
export async function listResenasAdmin(input?: { estado?: ResenaEstado | "todas"; q?: string }) {
  const { supabase } = await getAuthenticatedClient();
  let query = supabase
    .from("resenas")
    .select("*, products(nombre, imagen_url), customers(nombre, email)")
    .order("created_at", { ascending: false })
    .limit(300);

  if (input?.estado === "pendiente") {
    query = query.eq("aprobada", false).is("motivo_rechazo", null);
  } else if (input?.estado === "aprobada") {
    query = query.eq("aprobada", true);
  } else if (input?.estado === "rechazada") {
    query = query.eq("aprobada", false).not("motivo_rechazo", "is", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as ResenaAdmin[];
  const q = input?.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) =>
      r.titulo?.toLowerCase().includes(q) ||
      r.comentario?.toLowerCase().includes(q) ||
      r.products?.nombre?.toLowerCase().includes(q) ||
      r.customers?.nombre?.toLowerCase().includes(q)
    );
  }
  return { resenas: rows };
}

const ModerarSchema = z.object({
  id: z.string().uuid(),
  aprobada: z.boolean(),
  motivo_rechazo: z.string().max(500).optional().nullable(),
});

// Aprueba o rechaza una reseña. Al aprobar, limpia cualquier motivo de rechazo previo.
export async function moderarResena(input: z.infer<typeof ModerarSchema>) {
  const data = ModerarSchema.parse(input);
  const { supabase, userId } = await getAuthenticatedClient();

  const { error } = await supabase
    .from("resenas")
    .update({
      aprobada: data.aprobada,
      motivo_rechazo: data.aprobada ? null : (data.motivo_rechazo || "No cumple las políticas de reseñas"),
      moderada_por: userId,
      moderada_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

const ResponderSchema = z.object({
  id: z.string().uuid(),
  respuesta_tienda: z.string().min(1).max(1000),
});

// Respuesta pública de la tienda a una reseña (visible junto a la reseña aprobada)
export async function responderResena(input: z.infer<typeof ResponderSchema>) {
  const data = ResponderSchema.parse(input);
  const { supabase } = await getAuthenticatedClient();

  const { error } = await supabase
    .from("resenas")
    .update({
      respuesta_tienda: data.respuesta_tienda,
      respuesta_tienda_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}