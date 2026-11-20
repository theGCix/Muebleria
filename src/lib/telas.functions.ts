// src/lib/telas.functions.ts
// Catálogo de telas (tablas tela_categorias y telas). Solo admin: la RLS ya exige rol admin para escribir.
// Las fotos viven en Cloudinary (misma carpeta de siempre del panel); aquí solo se guarda la URL https.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;
async function db(): Promise<Db> {
  const { supabase } = await getAuthenticatedClient();
  return supabase as unknown as Db;
}

export interface CategoriaAdmin { id: number; nombre: string }
export interface TelaAdmin {
  id: string; numero: number; categoria_id: number; nombre: string; descripcion: string;
  imagen: string; hex: string; patron: boolean; activo: boolean;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
// La foto puede ser la de siempre (/telas/NN.webp) o una nueva subida a Cloudinary (https)
const IMAGEN = z.string().trim().regex(/^(\/telas\/[\w.-]+|https:\/\/.+)$/i, "Sube la foto de la tela");

const TelaSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(2, "Escribe el nombre").max(60),
  categoria_id: z.number().int().positive("Elige una categoría"),
  descripcion: z.string().trim().max(80).optional().default(""),
  imagen: IMAGEN,
  hex: z.string().regex(HEX, "Color inválido (ej. #8a7f72)"),
  patron: z.boolean(),
  activo: z.boolean(),
});
export type GuardarTelaInput = z.input<typeof TelaSchema>;

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "tela";

export async function listCatalogoAdmin(): Promise<{ categorias: CategoriaAdmin[]; telas: TelaAdmin[] }> {
  const c = await db();
  const [cat, tel] = await Promise.all([
    c.from("tela_categorias").select("id, nombre").order("id", { ascending: true }),
    c.from("telas").select("id, numero, categoria_id, nombre, descripcion, imagen, hex, patron, activo").order("numero", { ascending: true }),
  ]);
  if (cat.error) throw new Error(cat.error.message);
  if (tel.error) throw new Error(tel.error.message);
  return { categorias: (cat.data ?? []) as CategoriaAdmin[], telas: (tel.data ?? []) as TelaAdmin[] };
}

export async function guardarCategoria(input: { id?: number; nombre: string }) {
  const nombre = z.string().trim().min(2, "Escribe el nombre").max(50).parse(input.nombre);
  const c = await db();
  if (input.id) {
    const { error } = await c.from("tela_categorias").update({ nombre }).eq("id", input.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { data } = await c.from("tela_categorias").select("id").order("id", { ascending: false }).limit(1);
  const id = ((data?.[0] as { id: number } | undefined)?.id ?? 0) + 1;
  const { error } = await c.from("tela_categorias").insert({ id, nombre });
  if (error) throw new Error(error.message);
}

export async function eliminarCategoria(id: number) {
  const c = await db();
  const { count } = await c.from("telas").select("id", { count: "exact", head: true }).eq("categoria_id", id);
  if ((count ?? 0) > 0) throw new Error("Esta categoría tiene telas. Muévelas o elimínalas primero.");
  const { error } = await c.from("tela_categorias").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function guardarTela(input: GuardarTelaInput) {
  const v = TelaSchema.parse(input);
  const c = await db();
  const fila = {
    nombre: v.nombre, categoria_id: v.categoria_id, descripcion: v.descripcion ?? "",
    imagen: v.imagen, hex: v.hex.toLowerCase(), patron: v.patron, activo: v.activo,
  };
  if (v.id) {
    const { error } = await c.from("telas").update(fila).eq("id", v.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { data } = await c.from("telas").select("id, numero");
  const filas = (data ?? []) as { id: string; numero: number }[];
  const numero = Math.max(0, ...filas.map((f) => f.numero)) + 1;
  const usados = new Set(filas.map((f) => f.id));
  let id = slug(v.nombre);
  for (let n = 2; usados.has(id); n++) id = `${slug(v.nombre)}-${n}`;
  const { error } = await c.from("telas").insert({ id, numero, ...fila });
  if (error) throw new Error(error.message);
}

export async function setActivoTela(id: string, activo: boolean) {
  const c = await db();
  const { error } = await c.from("telas").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarTela(id: string) {
  const c = await db();
  const { error } = await c.from("telas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
