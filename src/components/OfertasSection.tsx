// src/components/OfertasSection.tsx
import { useOfertas } from "@/hooks/useProducts";
import { ProductCard } from "./ProductCard";
import { Flame } from "lucide-react";

export function OfertasSection() {
  const { data = [], isLoading } = useOfertas(8);

  // Sin productos en oferta: no mostramos la sección (evita un bloque vacío en la home)
  if (!isLoading && data.length === 0) return null;

  return (
    <section
      id="ofertas"
      className="py-14 px-4 relative overflow-hidden"
      style={{ background: "var(--gradient-warm)" }}
    >
      <div className="absolute inset-0 bg-background/93" />
      <div className="container mx-auto max-w-7xl relative">
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-destructive text-destructive-foreground">
            <Flame className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-3xl font-display font-semibold">Ofertas</h2>
        </div>
        <p className="text-muted-foreground mb-8 ml-12">
          Piezas seleccionadas con descuento por tiempo limitado
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
            ))}
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