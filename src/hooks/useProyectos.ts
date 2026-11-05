// src/hooks/useProyectos.ts
// Proyectos realizados por G&M. Se cargan desde el panel (/gestionar-proyectos).
// Distrito, tiempo, materiales y fotos antes/después son opcionales: solo se muestra lo que existe.
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
  distrito: string | null;
  tiempo_ejecucion: string | null;
  materiales: string[];
  fotos_antes: string[];
  fotos_despues: string[];
}

const COLUMNAS_BASE = "id, titulo, descripcion, etiqueta, anio, fotos, destacado, created_at";
const COLUMNAS_REALIZADOS = `${COLUMNAS_BASE}, distrito, tiempo_ejecucion, materiales, fotos_antes, fotos_despues, autorizacion_cliente`;

const soloHttps = (l: string[] | null | undefined) => (l ?? []).filter((f) => /^https:\/\//i.test(f));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;

async function consultar(columnas: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from("proyectos")
    .select(columnas)
    .eq("publicado", true)
    .order("destacado", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60) as Promise<{ data: Fila[] | null; error: unknown }>;
}

function normalizar(r: Fila): Proyecto {
  // El distrito y las fotos antes/después son del cliente: solo salen si autorizó (autorizacion_cliente).
  const autorizado = r.autorizacion_cliente === true;
  return {
    id: r.id,
    titulo: r.titulo,
    descripcion: r.descripcion ?? null,
    etiqueta: r.etiqueta ?? null,
    anio: r.anio ?? null,
    fotos: soloHttps(r.fotos),
    destacado: !!r.destacado,
    created_at: r.created_at,
    distrito: autorizado ? (String(r.distrito ?? "").trim() || null) : null,
    tiempo_ejecucion: String(r.tiempo_ejecucion ?? "").trim() || null,
    materiales: ((r.materiales ?? []) as string[]).map((m) => String(m).trim()).filter(Boolean),
    fotos_antes: autorizado ? soloHttps(r.fotos_antes) : [],
    fotos_despues: autorizado ? soloHttps(r.fotos_despues) : [],
  };
}

async function fetchProyectos(): Promise<Proyecto[]> {
  let { data, error } = await consultar(COLUMNAS_REALIZADOS);
  // Si la migración de «proyectos realizados» aún no se aplicó, se leen solo las columnas anteriores.
  if (error) ({ data, error } = await consultar(COLUMNAS_BASE));
  // Si la tabla aún no existe, no hay proyectos que mostrar.
  if (error) return [];
  return (data ?? []).map(normalizar).filter((p) => p.fotos.length > 0);
}

export function useProyectos() {
  return useQuery({ queryKey: ["proyectos-publicos"], staleTime: 5 * 60_000, retry: 1, queryFn: fetchProyectos });
}

/** true cuando hay al menos un proyecto publicado. */
export function useHayProyectos() {
  const { data } = useProyectos();
  return (data?.length ?? 0) >= 1;
}
