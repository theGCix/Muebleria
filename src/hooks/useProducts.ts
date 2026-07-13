import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  nombre: string;
  descripcion: string | null;
  sku: string | null;
  precio: number;
  stock: number | null;
  categoria: string | null;
  subcategoria: string | null;
  material_base: string | null;
  imagen_url: string | null;
  imagen_public_id: string | null;
  created_at: string;
}

export type ProductSort = "recientes" | "precio_asc" | "precio_desc";

export function useProducts(first = 12, search?: string) {
  return useQuery({
    queryKey: ["products-public", first, search ?? null],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(first);
      if (search) {
        q = q.or(`nombre.ilike.%${search}%,categoria.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });
}

interface CategoryQuery {
  categoria: string;
  subcategoria?: string;
  materialBase?: string;
  sort?: ProductSort;
}

/**
 * Productos de una categoría (y opcionalmente subcategoría / material_base),
 * usados por la página /categoria/$slug.
 * Equivale a: SELECT * FROM products WHERE categoria = ... [AND subcategoria = ...] [AND material_base = ...]
 */
export function useProductsByCategory({ categoria, subcategoria, materialBase, sort = "recientes" }: CategoryQuery) {
  return useQuery({
    queryKey: ["products-by-category", categoria, subcategoria ?? null, materialBase ?? null, sort],
    queryFn: async () => {
      let q = supabase.from("products").select("*").eq("categoria", categoria);
      if (subcategoria) q = q.eq("subcategoria", subcategoria);
      if (materialBase) q = q.eq("material_base", materialBase);

      if (sort === "precio_asc") q = q.order("precio", { ascending: true });
      else if (sort === "precio_desc") q = q.order("precio", { ascending: false });
      else q = q.order("created_at", { ascending: false });

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });
}

/**
 * Trae solo las columnas necesarias para calcular cuántos productos hay
 * por cada subcategoría / material_base dentro de una categoría — usado
 * para mostrar los contadores en los chips de filtro sin duplicar queries.
 */
export function useCategoryFacets(categoria: string) {
  return useQuery({
    queryKey: ["products-category-facets", categoria],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("subcategoria, material_base")
        .eq("categoria", categoria);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<Product, "subcategoria" | "material_base">[];
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data as Product;
    },
    enabled: !!id,
  });
}