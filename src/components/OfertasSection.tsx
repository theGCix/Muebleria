// src/components/OfertasSection.tsx
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useOfertas } from "@/hooks/useProducts";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";

// Con más páginas que esto, los puntos no caben en un móvil de 320 px (cada uno mide 44 px
// de alto/ancho táctil) y se cambia a contador + barra de avance.
const MAX_PUNTOS = 4;

export function OfertasSection() {
  const { data = [], isLoading } = useOfertas(24);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>();

  // Categorías con ofertas y cuántas hay en cada una
  const categorias = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const p of data)
      if (p.categoria) conteo.set(p.categoria, (conteo.get(p.categoria) ?? 0) + 1);
    return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtradas = categoria ? data.filter((p) => p.categoria === categoria) : data;
  const mayorAhorro = useMemo(() => Math.max(0, ...data.map((p) => ofertaInfo(p).ahorro)), [data]);

  // Sin productos en oferta: no mostramos la sección (evita un bloque vacío en la home)
  if (!isLoading && data.length === 0) return null;

  return (
    <section id="ofertas" className="relative scroll-mt-28 overflow-hidden px-4 py-14">
      <div className="absolute inset-0" style={{ background: "var(--gradient-warm)" }} />
      <div className="absolute inset-0 bg-background/93" />

      <div className="container relative mx-auto max-w-7xl">
        <div
          data-reveal
          className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-3xl font-semibold">Ofertas</h2>
              <p className="text-muted-foreground">
                {mayorAhorro > 0
                  ? `Hasta ${fmtPEN(mayorAhorro)} de ahorro en una sola pieza, por tiempo limitado`
                  : "Piezas seleccionadas con descuento por tiempo limitado"}
              </p>
            </div>
          </div>

          {categorias.length > 1 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar ofertas por categoría"
            >
              <Chip activo={categoria === null} onClick={() => setCategoria(null)}>
                Todas ({data.length})
              </Chip>
              {categorias.map(([c, n]) => (
                <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}>
                  {c} ({n})
                </Chip>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {/* key: al cambiar de categoría el carrusel vuelve a la primera página */}
            <Carousel
              key={categoria ?? "todas"}
              setApi={setApi}
              opts={{ align: "start", slidesToScroll: "auto", containScroll: "trimSnaps" }}
              aria-roledescription="carrusel"
              aria-label="Ofertas"
            >
              {/* py-3: el viewport recorta (overflow), y la sombra/inclinación de la tarjeta necesita aire */}
              <CarouselContent className="-ml-3 touch-pan-y touch-pinch-zoom py-3 sm:-ml-6">
                {filtradas.map((p, i) => (
                  <CarouselItem
                    key={p.id}
                    aria-roledescription="diapositiva"
                    aria-label={`${i + 1} de ${filtradas.length}`}
                    // Móvil: 2 tarjetas (como la grilla anterior); ≥ sm: 3; ≥ lg: 4.
                    // Las diapositivas se estiran a la misma altura y el pie de la tarjeta queda abajo (mt-auto).
                    className="basis-[46%] pl-3 sm:basis-1/3 sm:pl-6 lg:basis-1/4"
                  >
                    <ProductCard product={p} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            <ControlesCarrusel api={api} />
          </>
        )}
      </div>
    </section>
  );
}

/** Flechas + indicador de posición (puntos o contador). Todo táctil ≥ 44 px. */
function ControlesCarrusel({ api }: { api: CarouselApi }) {
  const [total, setTotal] = useState(0);
  const [actual, setActual] = useState(0);
  const [puedeAtras, setPuedeAtras] = useState(false);
  const [puedeAdelante, setPuedeAdelante] = useState(false);

  useEffect(() => {
    if (!api) return;
    const sincronizar = () => {
      setTotal(api.scrollSnapList().length);
      setActual(api.selectedScrollSnap());
      setPuedeAtras(api.canScrollPrev());
      setPuedeAdelante(api.canScrollNext());
    };
    sincronizar();
    // reInit se dispara al redimensionar: el número de páginas cambia entre móvil y escritorio
    api.on("select", sincronizar).on("reInit", sincronizar);
    return () => {
      api.off("select", sincronizar).off("reInit", sincronizar);
    };
  }, [api]);

  // Todo cabe en una sola página: no hay nada que navegar
  if (!api || total <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Flecha etiqueta="Ofertas anteriores" deshabilitado={!puedeAtras} onClick={() => api.scrollPrev()}>
        <ChevronLeft className="h-5 w-5" />
      </Flecha>

      {total <= MAX_PUNTOS ? (
        <div className="flex items-center" role="group" aria-label="Posición en el carrusel de ofertas">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => api.scrollTo(i)}
              aria-label={`Ir a la página ${i + 1} de ${total}`}
              aria-current={i === actual ? "true" : undefined}
              className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === actual
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/70 group-hover:bg-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex min-w-[8.5rem] flex-col items-center gap-1.5 px-2" aria-live="polite">
          <span className="text-sm font-medium tabular-nums text-foreground">
            {actual + 1} <span className="text-muted-foreground">/ {total}</span>
          </span>
          <span className="h-1 w-28 overflow-hidden rounded-full bg-muted-foreground/25" aria-hidden>
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${((actual + 1) / total) * 100}%` }}
            />
          </span>
        </div>
      )}

      <Flecha etiqueta="Ofertas siguientes" deshabilitado={!puedeAdelante} onClick={() => api.scrollNext()}>
        <ChevronRight className="h-5 w-5" />
      </Flecha>
    </div>
  );
}

function Flecha({
  etiqueta,
  deshabilitado,
  onClick,
  children,
}: {
  etiqueta: string;
  deshabilitado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}