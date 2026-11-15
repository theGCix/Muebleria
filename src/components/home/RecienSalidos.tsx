// src/components/home/RecienSalidos.tsx
// «Recién salidos del taller» (boceto v3): las piezas más recientes con foto (4 en PC y 4 en móvil, 2×2) con la tarjeta de
// producto de siempre (precio vigente, plazo y «Agregar»), y «Ver todo el catálogo (N piezas)». Reemplaza a ProductsSection
// en el home y conserva id="catalogo" (Footer, Header y Hero.tsx apuntan a ese ancla).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { ProductCard } from "@/components/ProductCard";

const PIEZAS = 4;

export function RecienSalidos() {
  const { data = [], isLoading } = useCatalogoHome(60);
  // Ya viene por created_at desc: las más recientes que tengan foto
  const recientes = useMemo(() => data.filter((p) => p.imagen_public_id || p.imagen_url).slice(0, PIEZAS), [data]);

  if (!isLoading && recientes.length === 0) return null;

  return (
    <section id="catalogo" aria-labelledby="recientes-titulo" className="scroll-mt-28 px-4 py-10 md:py-14">
      <div className="container mx-auto max-w-6xl">
        <h2 id="recientes-titulo" className="t-seccion">
          Directo del taller a tu hogar
        </h2>

        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4" aria-hidden>
            {Array.from({ length: PIEZAS }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
            {recientes.map((p) => (
              <div key={p.id}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="mt-8 flex justify-center">
            <Link
              to="/catalogo"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Ver todo el catálogo ({data.length} {data.length === 1 ? "pieza" : "piezas"})
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
