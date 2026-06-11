// src/components/ProductRecomendaciones.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "./ProductCard";
import { Loader2 } from "lucide-react";

async function fetchRecomendaciones(productId: string) {
  const { data, error } = await supabase.rpc("get_recomendaciones", {
    _product_id: productId,
    _limit: 4,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

export function ProductRecomendaciones({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["recomendaciones", productId],
    queryFn: () => fetchRecomendaciones(productId),
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