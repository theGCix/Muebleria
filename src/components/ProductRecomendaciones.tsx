// src/components/ProductRecomendaciones.tsx
// "También te puede gustar" — productos de la MISMA categoría
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "./ProductCard";

async function fetchMismaCategoria(productId: string, categoria: string | null) {
  if (!categoria) return [];
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("categoria", categoria)
    .eq("activo", true)
    .neq("id", productId)
    .limit(4);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function ProductRecomendaciones({
  productId, categoria,
}: { productId: string; categoria?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["recomendaciones-categoria", productId, categoria],
    queryFn: () => fetchMismaCategoria(productId, categoria ?? null),
    enabled: !!categoria,
    staleTime: 300_000,
  });

  if (isLoading) return null;
  if (!data?.length) return null;

  return (
    <section className="mt-16 pt-12 border-t border-border">
      <h2 className="font-display text-2xl font-semibold mb-6">
        También te puede gustar
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {data.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}