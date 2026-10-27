// src/lib/proyectos.functions.ts
// Proyectos: piezas especiales e innovaciones fabricadas por G&M (tabla proyectos). Solo admin.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<Db> {
  const { supabase } = await getAuthenticatedClient();
  return supabase as unknown as Db;
}

export interface ProyectoAdmin {
  id: string;
  titulo: string;
  descripcion: string | null;
  etiqueta: string | null;
  anio: number | null;
  fotos: string[];
  destacado: boolean;
  publicado: boolean;
  created_at: string;
}

const Schema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3, "Escribe un título").max(120),
  descripcion: z.string().trim().max(1500).nullable().optional(),
  etiqueta: z.string().trim().max(40).nullable().optional(),
  anio: z.number().int().min(2000).max(2100).nullable().optional(),
  fotos: z.array(z.string().regex(/^https:\/\//i)).min(1, "Sube al menos una foto").max(8),
  destacado: z.boolean(),
  publicado: z.boolean(),
});
export type GuardarProyectoInput = z.input<typeof Schema>;

export async function listProyectosAdmin(): Promise<ProyectoAdmin[]> {
  const c = await db();
  const { data, error } = await c.from("proyectos").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProyectoAdmin[];
}

export async function guardarProyecto(input: GuardarProyectoInput) {
  const v = Schema.parse(input);
  const c = await db();
  const fila = {
    titulo: v.titulo,
    descripcion: v.descripcion || null,
    etiqueta: v.etiqueta || null,
    anio: v.anio ?? null,
    fotos: v.fotos,
    destacado: v.destacado,
    publicado: v.publicado,
  };
  const { error } = v.id
    ? await c.from("proyectos").update(fila).eq("id", v.id)
    : await c.from("proyectos").insert(fila);
  if (error) throw new Error(error.message);
}

export async function setPublicadoProyecto(id: string, publicado: boolean) {
  const c = await db();
  const { error } = await c.from("proyectos").update({ publicado }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarProyecto(id: string) {
  const c = await db();
  const { error } = await c.from("proyectos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}