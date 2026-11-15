// src/components/PresupuestoHome.tsx
// «Explora según el rango que te acomode»: selector de presupuesto y «¿Para qué es?» (segmentos), debajo de las
// categorías (antes eran la portada). Cada tramo es un enlace a /catalogo?min=…&max=… (funciona con teclado y sin
// JavaScript). Los tramos viven en lib/presupuesto.ts; el conteo sale de los productos reales (misma consulta y
// caché que Categories y el catálogo del home: no agrega peticiones).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { TRAMOS, contarPorTramo, etiquetaRango } from "@/lib/presupuesto";
import { SelectorSegmento } from "@/components/SelectorSegmento";
import { useSegmento } from "@/hooks/useSegmento";
import { accionSugerida } from "@/lib/segmentos";
import { trackSegmento } from "@/lib/analytics";

const plural = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

export function PresupuestoHome() {
  const { data } = useCatalogoHome(60);
  const conteo = useMemo(() => (data ? contarPorTramo(data) : null), [data]);

  // Con datos cargados, un tramo sin piezas no se ofrece (llevaría a una lista vacía)
  const tramos = TRAMOS.filter((t) => !conteo || conteo[t.id] > 0);

  // «¿Para qué es?»: opcional; prellena los formularios de cotización y mide qué segmentos llegan
  const [segmento, setSegmento] = useSegmento();
  const accion = accionSugerida(segmento);

  return (
    <section id="presupuesto" aria-labelledby="presupuesto-titulo" className="border-y border-border/60 bg-card">
      <div className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div data-reveal>
          <h2 id="presupuesto-titulo" className="t-seccion text-foreground">
            Explora según el rango que te acomode
          </h2>
          <p className="t-texto mt-1 max-w-xl text-muted-foreground">
            Elige cuánto quieres invertir y mira las piezas del taller que entran en ese presupuesto.
          </p>

          <ul aria-labelledby="presupuesto-titulo" className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
            {tramos.map((t) => (
              <li key={t.id}>
                <Link
                  to="/catalogo"
                  search={{ min: t.min, max: t.max }}
                  className="flex h-full min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-2 text-foreground shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[64px] sm:flex-col sm:justify-center sm:gap-0 sm:py-3"
                >
                  <span className="t-producto text-balance">{etiquetaRango(t)}</span>
                  {conteo && <span className="t-apoyo text-muted-foreground">{plural(conteo[t.id])}</span>}
                </Link>
              </li>
            ))}
          </ul>

          <SelectorSegmento
            label="Cuéntanos para qué lo buscas"
            deslizable
            value={segmento}
            onChange={(v) => {
              setSegmento(v);
              if (v) trackSegmento(v);
            }}
            className="mt-6"
          />
          {accion && (
            <p data-testid="accion-segmento" className="t-texto mt-3">
              {accion.destino === "medida" ? (
                <a href="#a-medida" className="font-semibold text-primary underline underline-offset-4">
                  {accion.texto}
                </a>
              ) : (
                <Link to="/envios" className="font-semibold text-primary underline underline-offset-4">
                  {accion.texto}
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
