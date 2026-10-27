// src/hooks/useGaleriaClientes.ts
// Testimonios con foto (/testimonios): fotos REALES de clientes con sus muebles. Salen de dos fuentes:
//  1) las reseñas aprobadas (4–5 estrellas) que traen fotos (se moderan en /resenas), y
//  2) la galería de clientes (tabla galeria_clientes): lo que carga el equipo desde el panel y lo que envían
//     los clientes al recibir su pedido, siempre que el equipo lo haya aprobado.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResenaPublica } from "@/lib/resenas.functions";

/** Con menos fotos que esto la galería no se anuncia (ni en el pie ni en testimonios). */
export const MIN_GALERIA = 3;

export interface FotoCliente extends ResenaPublica {
  producto_nombre: string | null;
  categoria: string | null;
  /** "resena" y "cliente" son compras verificadas; "panel" lo cargó el equipo. */
  origen: "resena" | "cliente" | "panel";
}

interface GaleriaFila {
  id: string;
  autor_nombre: string;
  fotos: string[] | null;
  comentario: string | null;
  calificacion: number | null;
  product_id: string | null;
  producto_nombre: string | null;
  origen: "panel" | "cliente" | null;
  created_at: string;
}

const soloHttps = (fotos: string[] | null | undefined) => (fotos ?? []).filter((f) => /^https:\/\//i.test(f));

async function fetchResenas(): Promise<Omit<FotoCliente, "producto_nombre" | "categoria">[]> {
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

async function fetchGaleria(): Promise<GaleriaFila[]> {
  // Si la tabla aún no existe (migración pendiente), los testimonios siguen con las reseñas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("galeria_clientes")
    .select("id, autor_nombre, fotos, comentario, calificacion, product_id, producto_nombre, origen, created_at")
    .eq("publicado", true)
    .eq("estado", "aprobada")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) return [];
  return ((data ?? []) as GaleriaFila[]).filter((r) => soloHttps(r.fotos).length > 0);
}

async function fetchFotos(): Promise<FotoCliente[]> {
  const [resenas, galeria] = await Promise.all([fetchResenas(), fetchGaleria()]);

  // Nombre y categoría del mueble (la vista pública solo trae product_id)
  const ids = [...new Set([...resenas.map((r) => r.product_id), ...galeria.map((m) => m.product_id)].filter((x): x is string => !!x))];
  const prods = new Map<string, { nombre: string; categoria: string | null }>();
  if (ids.length > 0) {
    const { data: ps } = await supabase.from("products").select("id, nombre, categoria").in("id", ids);
    for (const p of (ps ?? []) as unknown as { id: string; nombre: string; categoria: string | null }[]) {
      prods.set(String(p.id), { nombre: p.nombre, categoria: p.categoria });
    }
  }

  const deResenas: FotoCliente[] = resenas.map((r) => ({
    ...r,
    producto_nombre: prods.get(r.product_id)?.nombre ?? null,
    categoria: prods.get(r.product_id)?.categoria ?? null,
  }));

  const deGaleria: FotoCliente[] = galeria.map((m) => ({
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
    origen: m.origen === "cliente" ? "cliente" : "panel",
  }));

  return [...deResenas, ...deGaleria].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useGaleriaClientes() {
  return useQuery({
    queryKey: ["galeria-publica"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: fetchFotos,
  });
}

/** true cuando hay suficientes fotos para mostrar la galería de testimonios. */
export function useHayGaleria() {
  const { data } = useGaleriaClientes();
  return (data?.length ?? 0) >= MIN_GALERIA;
}