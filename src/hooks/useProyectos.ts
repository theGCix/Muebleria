// src/hooks/useProyectos.ts
// "Proyectos realizados": fotos REALES de muebles entregados, tomadas de las reseñas aprobadas
// (4–5 estrellas) que traen fotos. No hay nada que cargar aparte: se moderan desde /resenas.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResenaPublica } from "@/lib/resenas.functions";

/** Con menos proyectos que esto la galería no se anuncia (ni en el pie ni en testimonios). */
export const MIN_PROYECTOS = 3;

export interface Proyecto extends ResenaPublica {
  producto_nombre: string | null;
  categoria: string | null;
}

async function fetchProyectos(): Promise<Proyecto[]> {
  const { data, error } = await supabase
    .from("v_resenas_publicas")
    .select("*")
    .gte("calificacion", 4)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);

  const conFoto = ((data ?? []) as unknown as ResenaPublica[])
    .map((r) => ({ ...r, fotos: (r.fotos ?? []).filter((f) => /^https:\/\//i.test(f)) }))
    .filter((r) => r.fotos.length > 0);

  // La vista pública solo trae product_id: buscamos nombre y categoría del mueble
  const ids = [...new Set(conFoto.map((r) => r.product_id))];
  const prods = new Map<string, { nombre: string; categoria: string | null }>();
  if (ids.length > 0) {
    const { data: ps } = await supabase.from("products").select("id, nombre, categoria").in("id", ids);
    for (const p of (ps ?? []) as unknown as { id: string; nombre: string; categoria: string | null }[]) {
      prods.set(p.id, { nombre: p.nombre, categoria: p.categoria });
    }
  }

  return conFoto.map((r) => ({
    ...r,
    producto_nombre: prods.get(r.product_id)?.nombre ?? null,
    categoria: prods.get(r.product_id)?.categoria ?? null,
  }));
}

export function useProyectos() {
  return useQuery({
    queryKey: ["proyectos-publicos"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: fetchProyectos,
  });
}

/** true cuando hay suficientes proyectos con foto para mostrar la galería. */
export function useHayProyectos() {
  const { data } = useProyectos();
  return (data?.length ?? 0) >= MIN_PROYECTOS;
}