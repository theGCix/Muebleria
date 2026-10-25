// src/components/CombosSection.tsx
// Banner del combo destacado + el resto de los combos en cuadrícula.
import { useMemo } from "react";
import { comboDestacado, useCombos } from "@/hooks/useCombos";
import { ComboBanner } from "./ComboBanner";
import { ComboCard } from "./ComboCard";
import { PackageCheck } from "lucide-react";

export function CombosSection() {
  const { data = [], isLoading } = useCombos(6);

  const destacado = useMemo(() => comboDestacado(data), [data]);
  const resto = useMemo(() => data.filter((c) => c.id !== destacado?.id), [data, destacado]);

  // Sin combos activos: no mostramos la sección
  if (!isLoading && data.length === 0) return null;

  return (
    <section id="combos" className="scroll-mt-28 px-4 py-14">
      <div className="container mx-auto max-w-7xl">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {destacado && (
              <div data-reveal="panel">
                <ComboBanner combo={destacado} otros={resto.length} />
              </div>
            )}

            {resto.length > 0 && (
              <div id="combos-todos" className={destacado ? "mt-14 scroll-mt-28" : ""}>
                <div className="mb-1 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <PackageCheck className="h-4.5 w-4.5" />
                  </span>
                  <h2 className="font-display text-3xl font-semibold">
                    {destacado ? "Más combos" : "Combos"}
                  </h2>
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                    {resto.length} {resto.length === 1 ? "combo" : "combos"}
                  </span>
                </div>
                <p className="mb-8 ml-12 text-muted-foreground">
                  Combina piezas y ahorra más que comprándolas por separado
                </p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {resto.map((c) => (
                    <ComboCard key={c.id} combo={c} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
