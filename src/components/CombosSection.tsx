// src/components/CombosSection.tsx
import { useCombos } from "@/hooks/useCombos";
import { ComboCard } from "./ComboCard";
import { PackageCheck } from "lucide-react";

export function CombosSection() {
  const { data = [], isLoading } = useCombos(6);

  // Sin combos activos: no mostramos la sección
  if (!isLoading && data.length === 0) return null;

  return (
    <section id="combos" className="py-14 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-1">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-accent text-accent-foreground">
            <PackageCheck className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-3xl font-display font-semibold">Combos</h2>
          {!isLoading && data.length > 0 && (
            <span className="text-xs font-semibold bg-accent/10 text-accent rounded-full px-2.5 py-1">
              {data.length} {data.length === 1 ? "combo" : "combos"}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mb-8 ml-12">
          Combina piezas y ahorra más que comprándolas por separado
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((c) => (
              <ComboCard key={c.id} combo={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}