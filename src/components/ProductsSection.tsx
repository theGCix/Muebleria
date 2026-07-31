import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "./ProductCard";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useSearchStore } from "@/stores/searchStore";

export function ProductsSection() {
  const storeQuery = useSearchStore((s) => s.query);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  const [search, setSearch] = useState(storeQuery);
  const { data = [], isLoading } = useProducts(24, search || undefined);

  // Si la búsqueda se dispara desde el navbar, refleja el término aquí.
  useEffect(() => {
    setSearch(storeQuery);
  }, [storeQuery]);

  return (
    <section id="catalogo" className="py-16 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-display font-semibold">Catálogo</h2>
            <p className="text-muted-foreground mt-1">Encuentra el mueble perfecto para tu hogar</p>
          </div>
          <Input
            placeholder="Buscar productos…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setStoreQuery(e.target.value);
            }}
            className="max-w-xs"
          />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No se encontraron productos.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}