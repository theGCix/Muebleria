import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "./ProductCard";
import { Loader2, Package } from "lucide-react";

export function ProductsSection() {
  const { data: products, isLoading, error } = useProducts(12);

  return (
    <section id="catalogo" className="container mx-auto px-6 py-24">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium mb-4">Catálogo</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground">
            Nuestros muebles
          </h2>
        </div>
        <p className="text-muted-foreground max-w-md">
          Cada pieza está cuidadosamente seleccionada y elaborada por nuestros artesanos.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">
          No se pudieron cargar los productos.
        </div>
      )}

      {!isLoading && products && products.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-2xl font-semibold mb-2">Sin productos todavía</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Pídele al asistente que cree tu primer mueble indicando nombre, precio y descripción.
          </p>
        </div>
      )}

      {products && products.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.node.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}