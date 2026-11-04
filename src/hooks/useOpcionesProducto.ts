// src/hooks/useOpcionesProducto.ts
// Opciones por producto (color, tapizado, firmeza, patas) leídas de la BD. RLS pública: solo grupos de
// productos activos y valores activos. El servidor vuelve a validar y a calcular el precio al cobrar.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OpcionValor {
  id: string;
  valor: string;
  descripcion: string | null;
  material: string | null;
  cuidado: string | null;
  hex: string | null;
  image_url: string | null;
  /** Suma sobre el precio de lista (la oferta se aplica DESPUÉS, sobre el total). */
  ajuste_precio: number;
  es_default: boolean;
  orden: number;
}

export interface OpcionGrupo {
  id: string;
  tipo: string;
  etiqueta: string;
  obligatorio: boolean;
  orden: number;
  valores: OpcionValor[];
}

/** Elección: grupo_id → valor_id. */
export type SeleccionOpciones = Record<string, string>;

export async function fetchOpcionesProducto(productId: string): Promise<OpcionGrupo[]> {
  // Las tablas nuevas aún no están en types.ts → cliente sin tipar para estas dos consultas
  const { data, error } = await (supabase as any)
    .from("producto_opcion_grupos")
    .select(
      "id, tipo, etiqueta, obligatorio, orden, producto_opcion_valores(id, valor, descripcion, material, cuidado, hex, image_url, ajuste_precio, es_default, activo, orden)",
    )
    .eq("product_id", productId)
    .order("orden", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((g) => ({
      id: g.id as string,
      tipo: g.tipo as string,
      etiqueta: g.etiqueta as string,
      obligatorio: g.obligatorio !== false,
      orden: (g.orden as number) ?? 0,
      valores: ((g.producto_opcion_valores ?? []) as any[])
        .filter((v) => v.activo !== false)
        .map((v) => ({
          id: v.id as string,
          valor: v.valor as string,
          descripcion: v.descripcion ?? null,
          material: v.material ?? null,
          cuidado: v.cuidado ?? null,
          hex: v.hex ?? null,
          image_url: v.image_url ?? null,
          ajuste_precio: Number(v.ajuste_precio) || 0,
          es_default: !!v.es_default,
          orden: (v.orden as number) ?? 0,
        }))
        .sort((a, b) => a.orden - b.orden),
    }))
    .filter((g) => g.valores.length > 0)
    .sort((a, b) => a.orden - b.orden);
}

/** `cargando` solo es true mientras no se sabe si el producto tiene opciones; si la consulta falla, se usa el respaldo (sin opciones). */
export function useOpcionesProducto(productId: string) {
  const q = useQuery({
    queryKey: ["opciones-producto", productId],
    queryFn: () => fetchOpcionesProducto(productId),
    staleTime: 60_000,
    retry: 1,
  });
  return { grupos: q.data ?? [], cargando: q.isPending };
}

/** Valor elegido de un grupo: el del cliente, si no el predeterminado, si no el primero (solo grupos obligatorios). */
export function valorElegido(g: OpcionGrupo, sel: SeleccionOpciones): OpcionValor | undefined {
  return (
    g.valores.find((v) => v.id === sel[g.id]) ??
    g.valores.find((v) => v.es_default) ??
    (g.obligatorio ? g.valores[0] : undefined)
  );
}

/** Valores efectivamente elegidos (uno por grupo) y suma de sus ajustes de lista. */
export function resolverSeleccion(grupos: OpcionGrupo[], sel: SeleccionOpciones) {
  const elegidos = grupos
    .map((g) => ({ grupo: g, valor: valorElegido(g, sel) }))
    .filter((x): x is { grupo: OpcionGrupo; valor: OpcionValor } => !!x.valor);
  const ajuste = Math.round(elegidos.reduce((s, x) => s + x.valor.ajuste_precio, 0) * 100) / 100;
  return { elegidos, ajuste, ids: elegidos.map((x) => x.valor.id) };
}