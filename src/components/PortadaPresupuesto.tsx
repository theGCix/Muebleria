// src/components/PortadaPresupuesto.tsx
// Portada corta del home: título, una línea de apoyo, selector de presupuesto y un enlace al
// catálogo completo. Cada tramo es un enlace a /catalogo?min=…&max=… (funciona con teclado y
// sin JavaScript). Los tramos viven en lib/presupuesto.ts; el conteo sale de los productos
// reales (misma consulta y caché que Categories y el catálogo del home: no agrega peticiones).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { TRAMOS, contarPorTramo, etiquetaRango } from "@/lib/presupuesto";

const plural = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

export function PortadaPresupuesto() {
  const { data } = useCatalogoHome(60);
  const conteo = useMemo(() => (data ? contarPorTramo(data) : null), [data]);

  // Con datos cargados, un tramo sin piezas no se ofrece (llevaría a una lista vacía)
  const tramos = TRAMOS.filter((t) => !conteo || conteo[t.id] > 0);

  return (
    <section data-hero className="bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-14 text-center md:py-24">
        <h1 data-hero-title className="t-titulo text-foreground">
          Muebles hechos a mano, a tu presupuesto
        </h1>
        <p data-hero-item className="t-texto mx-auto mt-4 max-w-xl text-muted-foreground">
          Elige cuánto quieres invertir y mira lo que el taller puede hacer.
        </p>

        <div data-hero-item className="mt-8">
          <p id="presupuesto-etiqueta" className="t-apoyo mb-3 text-muted-foreground">
            ¿Cuánto quieres invertir?
          </p>
          <ul
            aria-labelledby="presupuesto-etiqueta"
            className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3"
          >
            {tramos.map((t) => (
              <li key={t.id}>
                <Link
                  to="/catalogo"
                  search={{ min: t.min, max: t.max }}
                  className="flex min-h-[64px] flex-col items-center justify-center rounded-2xl border border-border bg-card px-4 py-3 text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="t-producto">{etiquetaRango(t)}</span>
                  {conteo && <span className="t-apoyo text-muted-foreground">{plural(conteo[t.id])}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div data-hero-item className="mt-6">
          <Link
            to="/catalogo"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todo el catálogo <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
