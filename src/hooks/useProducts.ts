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
  imagen_url: string | null;
  imagen_public_id: string | null;
  created_at: string;
}

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
