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
  // Proyectos realizados (migración 20261105): pueden faltar si aún no se aplicó.
  distrito?: string | null;
  tiempo_ejecucion?: string | null;
  materiales?: string[] | null;
  fotos_antes?: string[] | null;
  fotos_despues?: string[] | null;
  autorizacion_cliente?: boolean | null;
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
  distrito: z.string().trim().max(60).nullable().optional(),
  tiempo_ejecucion: z.string().trim().max(40).nullable().optional(),
  materiales: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  fotos_antes: z.array(z.string().regex(/^https:\/\//i)).max(4).optional(),
  fotos_despues: z.array(z.string().regex(/^https:\/\//i)).max(4).optional(),
  autorizacion_cliente: z.boolean().optional(),
}).superRefine((v, ctx) => {
  // El distrito y las fotos antes/después son del cliente: para publicarlos hace falta su autorización.
  const datosDelCliente = !!v.distrito?.trim() || (v.fotos_antes?.length ?? 0) > 0 || (v.fotos_despues?.length ?? 0) > 0;
  if (v.publicado && datosDelCliente && !v.autorizacion_cliente)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["autorizacion_cliente"],
      message: "Para publicar el distrito o las fotos antes/después confirma que el cliente lo autorizó",
    });
});
export type GuardarProyectoInput = z.input<typeof Schema>;

export async function listProyectosAdmin(): Promise<ProyectoAdmin[]> {
  const c = await db();
  const { data, error } = await c.from("proyectos").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProyectoAdmin[];
}

export async function guardarProyecto(input: GuardarProyectoInput) {
  const r = Schema.safeParse(input);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Datos no válidos");
  const v = r.data;
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
  // Proyectos realizados (migración 20261105): distrito, tiempo, materiales, antes/después y autorización.
  const extras = {
    distrito: v.distrito || null,
    tiempo_ejecucion: v.tiempo_ejecucion || null,
    materiales: v.materiales ?? [],
    fotos_antes: v.fotos_antes ?? [],
    fotos_despues: v.fotos_despues ?? [],
    autorizacion_cliente: v.autorizacion_cliente ?? false,
  };
  const sinExtras =
    !extras.distrito && !extras.tiempo_ejecucion && extras.materiales.length === 0 &&
    extras.fotos_antes.length === 0 && extras.fotos_despues.length === 0 && !extras.autorizacion_cliente;
  const escribir = (f: Record<string, unknown>) =>
    v.id ? c.from("proyectos").update(f).eq("id", v.id) : c.from("proyectos").insert(f);

  let { error } = await escribir({ ...fila, ...extras });
  // Si la migración aún no se aplicó, un proyecto sin datos nuevos se sigue guardando como antes.
  if (error && sinExtras && /column|schema cache|PGRST204|42703/i.test(`${error.code ?? ""} ${error.message}`))
    ({ error } = await escribir(fila));
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