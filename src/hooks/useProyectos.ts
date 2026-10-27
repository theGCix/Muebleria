// src/hooks/useProyectos.ts
// Galería pública (/proyectos): fotos REALES de clientes con sus muebles. Salen de dos fuentes:
//  1) las reseñas aprobadas (4–5 estrellas) que traen fotos (se moderan en /resenas), y
//  2) los testimonios cargados a mano en el panel (/testimonios, tabla galeria_clientes).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResenaPublica } from "@/lib/resenas.functions";

/** Con menos fotos que esto la galería no se anuncia (ni en el pie ni en testimonios). */
export const MIN_PROYECTOS = 3;

export interface Proyecto extends ResenaPublica {
  producto_nombre: string | null;
  categoria: string | null;
  /** "resena": compra verificada. "manual": cargado desde el panel. */
  origen: "resena" | "manual";
}

interface GaleriaFila {
  id: string;
  autor_nombre: string;
  fotos: string[] | null;
  comentario: string | null;
  calificacion: number | null;
  product_id: string | null;
  producto_nombre: string | null;
  created_at: string;
}

const soloHttps = (fotos: string[] | null | undefined) => (fotos ?? []).filter((f) => /^https:\/\//i.test(f));

async function fetchResenas(): Promise<Omit<Proyecto, "producto_nombre" | "categoria">[]> {
  const { data, error } = await supabase
    .from("v_resenas_publicas")
    .select("*")
    .gte("calificacion", 4)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ResenaPublica[])
    .map((r) => ({ ...r, fotos: soloHttps(r.fotos), origen: "resena" as const }))
    .filter((r) => r.fotos.length > 0);
}

async function fetchManuales(): Promise<GaleriaFila[]> {
  // Si la tabla aún no existe (migración pendiente), la galería sigue con las reseñas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("galeria_clientes")
    .select("id, autor_nombre, fotos, comentario, calificacion, product_id, producto_nombre, created_at")
    .eq("publicado", true)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) return [];
  return ((data ?? []) as GaleriaFila[]).filter((r) => soloHttps(r.fotos).length > 0);
}

async function fetchProyectos(): Promise<Proyecto[]> {
  const [resenas, manuales] = await Promise.all([fetchResenas(), fetchManuales()]);

  // Nombre y categoría del mueble (la vista pública solo trae product_id)
  const ids = [...new Set([...resenas.map((r) => r.product_id), ...manuales.map((m) => m.product_id)].filter((x): x is string => !!x))];
  const prods = new Map<string, { nombre: string; categoria: string | null }>();
  if (ids.length > 0) {
    const { data: ps } = await supabase.from("products").select("id, nombre, categoria").in("id", ids);
    for (const p of (ps ?? []) as unknown as { id: string; nombre: string; categoria: string | null }[]) {
      prods.set(String(p.id), { nombre: p.nombre, categoria: p.categoria });
    }
  }

  const deResenas: Proyecto[] = resenas.map((r) => ({
    ...r,
    producto_nombre: prods.get(r.product_id)?.nombre ?? null,
    categoria: prods.get(r.product_id)?.categoria ?? null,
  }));

  const deManuales: Proyecto[] = manuales.map((m) => ({
    id: m.id,
    product_id: m.product_id ?? "",
    calificacion: m.calificacion ?? 0, // 0 = sin calificación (no se muestran estrellas)
    titulo: null,
    comentario: m.comentario,
    fotos: soloHttps(m.fotos),
    votos_utiles: 0,
    respuesta_tienda: null,
    respuesta_tienda_at: null,
    created_at: m.created_at,
    autor_nombre: m.autor_nombre,
    producto_nombre: (m.product_id && prods.get(m.product_id)?.nombre) || m.producto_nombre,
    categoria: (m.product_id && prods.get(m.product_id)?.categoria) || null,
    origen: "manual",
  }));

  return [...deResenas, ...deManuales].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useProyectos() {
  return useQuery({
    queryKey: ["proyectos-publicos"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: fetchProyectos,
  });
}

/** true cuando hay suficientes fotos para mostrar la galería. */
export function useHayProyectos() {
  const { data } = useProyectos();
  return (data?.length ?? 0) >= MIN_PROYECTOS;
}