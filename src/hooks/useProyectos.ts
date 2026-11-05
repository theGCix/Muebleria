// src/hooks/useProyectos.ts
// Proyectos: piezas especiales e innovaciones fabricadas por G&M. Se cargan desde el panel (/gestionar-proyectos).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Proyecto {
  id: string;
  titulo: string;
  descripcion: string | null;
  etiqueta: string | null;
  anio: number | null;
  fotos: string[];
  destacado: boolean;
  created_at: string;
}

async function fetchProyectos(): Promise<Proyecto[]> {
  // Si la tabla aún no existe (migración pendiente), no hay proyectos que mostrar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("proyectos")
    .select("id, titulo, descripcion, etiqueta, anio, fotos, destacado, created_at")
    .eq("publicado", true)
    .order("destacado", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return [];
  return ((data ?? []) as Proyecto[])
    .map((p) => ({ ...p, fotos: (p.fotos ?? []).filter((f) => /^https:\/\//i.test(f)) }))
    .filter((p) => p.fotos.length > 0);
}

export function useProyectos() {
  return useQuery({ queryKey: ["proyectos-publicos"], staleTime: 5 * 60_000, retry: 1, queryFn: fetchProyectos });
}

/** true cuando hay al menos un proyecto publicado. */
export function useHayProyectos() {
  const { data } = useProyectos();
  return (data?.length ?? 0) >= 1;
}