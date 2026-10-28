// src/lib/galeria.functions.ts
// Testimonios con fotos de clientes (tabla galeria_clientes): cargados desde el panel o enviados por el cliente
// al recibir su pedido (quedan pendientes hasta que el equipo los aprueba).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// La tabla aún no está en types.ts (se regenera con el CLI de Supabase).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<{ c: Db; userId: string }> {
  const { supabase, userId } = await getAuthenticatedClient();
  return { c: supabase as unknown as Db, userId };
}

export type GaleriaEstado = "pendiente" | "aprobada" | "rechazada";

export interface GaleriaItem {
  id: string;
  autor_nombre: string;
  fotos: string[];
  comentario: string | null;
  calificacion: number | null;
  product_id: string | null;
  producto_nombre: string | null;
  publicado: boolean;
  estado: GaleriaEstado;
  /** "panel": lo cargó el equipo. "cliente": lo envió el cliente al recibir su pedido. */
  origen: "panel" | "cliente";
  order_id: string | null;
  motivo_rechazo: string | null;
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
  const { c } = await db();
  const { data, error } = await c.from("galeria_clientes").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as GaleriaItem[];
}

/** Crea (estado aprobada) o edita un testimonio. Al editar no cambia su estado de moderación. */
export async function guardarGaleria(input: GuardarGaleriaInput) {
  const v = GuardarSchema.parse(input);
  const { c } = await db();
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
    : await c.from("galeria_clientes").insert({ ...fila, estado: "aprobada", origen: "panel" });
  if (error) throw new Error(error.message);
}

/** Aprueba (se publica) o rechaza lo que envió un cliente. */
export async function moderarGaleria(input: { id: string; accion: "aprobar" | "rechazar"; motivo?: string }) {
  const { c, userId } = await db();
  const aprobar = input.accion === "aprobar";
  const { error } = await c
    .from("galeria_clientes")
    .update({
      estado: aprobar ? "aprobada" : "rechazada",
      publicado: aprobar,
      motivo_rechazo: aprobar ? null : input.motivo?.trim().slice(0, 300) || null,
      moderada_at: new Date().toISOString(),
      moderada_por: userId,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function setPublicadoGaleria(id: string, publicado: boolean) {
  const { c } = await db();
  const { error } = await c.from("galeria_clientes").update({ publicado }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarGaleria(id: string) {
  const { c } = await db();
  const { error } = await c.from("galeria_clientes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listProductosBasico(): Promise<{ id: string; nombre: string }[]> {
  const { c } = await db();
  const { data, error } = await c.from("products").select("id, nombre").order("nombre").limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string | number; nombre: string }[]).map((p) => ({ id: String(p.id), nombre: p.nombre }));
}