// src/lib/carrusel.functions.ts
// Diapositivas manuales del carrusel del home (tabla carrusel_slides). Solo admin.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<Db> {
  const { supabase } = await getAuthenticatedClient();
  return supabase as unknown as Db;
}

export interface SlideAdmin {
  id: string;
  imagen_url: string;
  etiqueta: string | null;
  titulo: string | null;
  bajada: string | null;
  cta: string | null;
  enlace: string | null;
  orden: number;
  publicado: boolean;
  desde: string | null;
  hasta: string | null;
  created_at: string;
}

const opt = (max: number) => z.string().trim().max(max).nullable().optional();

const Schema = z.object({
  id: z.string().uuid().optional(),
  imagen_url: z.string().regex(/^https:\/\//i, "Sube una imagen"),
  etiqueta: opt(40),
  titulo: opt(90),
  bajada: opt(160),
  cta: opt(30),
  // Ruta interna (/catalogo), ancla (#a-medida) o URL https
  enlace: z
    .string()
    .trim()
    .max(300)
    .regex(/^(\/|#|https:\/\/)/, "Usa una ruta (/catalogo), un ancla (#a-medida) o https://")
    .nullable()
    .optional()
    .or(z.literal("")),
  publicado: z.boolean(),
  desde: z.string().nullable().optional(),
  hasta: z.string().nullable().optional(),
});
export type GuardarSlideInput = z.input<typeof Schema>;

export async function listSlidesAdmin(): Promise<SlideAdmin[]> {
  const c = await db();
  const { data, error } = await c
    .from("carrusel_slides")
    .select("*")
    .order("orden", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as SlideAdmin[];
}

export async function guardarSlide(input: GuardarSlideInput, ordenNuevo = 0) {
  const v = Schema.parse(input);
  const c = await db();
  const fila = {
    imagen_url: v.imagen_url,
    etiqueta: v.etiqueta || null,
    titulo: v.titulo || null,
    bajada: v.bajada || null,
    cta: v.cta || null,
    enlace: v.enlace || null,
    publicado: v.publicado,
    desde: v.desde ? new Date(v.desde).toISOString() : null,
    hasta: v.hasta ? new Date(v.hasta).toISOString() : null,
  };
  const { error } = v.id
    ? await c.from("carrusel_slides").update(fila).eq("id", v.id)
    : await c.from("carrusel_slides").insert({ ...fila, orden: ordenNuevo });
  if (error) throw new Error(error.message);
}

export async function setPublicadoSlide(id: string, publicado: boolean) {
  const c = await db();
  const { error } = await c.from("carrusel_slides").update({ publicado }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Reescribe el orden de todas las diapositivas según el arreglo de ids recibido. */
export async function guardarOrden(ids: string[]) {
  const c = await db();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await c.from("carrusel_slides").update({ orden: i }).eq("id", ids[i]);
    if (error) throw new Error(error.message);
  }
}

export async function eliminarSlide(id: string) {
  const c = await db();
  const { error } = await c.from("carrusel_slides").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
